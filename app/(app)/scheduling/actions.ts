'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrgIdFromUser } from '@/lib/get-org-id'
import { requireOrgContext } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { resend } from '@/lib/email/resend'
import { cancellationEmail, rescheduleEmail, noShowFollowUpEmail } from '@/lib/email/templates'
import { deleteGoogleCalendarEvent } from '@/lib/google/calendar'
import { logAppointmentEvent } from '@/lib/appointments/log-event'

// ── Email helper (fire-and-forget, never throws) ──────────────────────────────

async function fetchAptForEmail(id: string, orgId: string) {
  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('appointments')
      .select('scheduled_at, manage_token, lead:lead_id(contact_name, contact_last_name, contact_email), org:organization_id(name, slug)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single()
    return data
  } catch { return null }
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(iso))
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  }).format(new Date(iso))
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function cancelAppointment(id: string): Promise<{ error?: string }> {
  const { orgId, role } = await requireOrgContext()
  if (role === 'doctor') throw new Error('FORBIDDEN')

  const admin = createServiceClient()

  // Tenant fence: solo la org del que llama. 0 filas ⇒ cita ajena ⇒ abortar
  // ANTES de tocar lead / calendar / email.
  const { data: updated, error } = await admin
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('id')
  if (error) return { error: error.message }
  if (!updated || updated.length === 0) throw new Error('FORBIDDEN')
  revalidatePath('/scheduling/calendar')

  // Sync lead status to cancelo_cita (org-fenced)
  const { data: aptLead } = await admin
    .from('appointments')
    .select('lead_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (aptLead?.lead_id) {
    await admin.from('leads').update({ status: 'cancelo_cita' }).eq('id', aptLead.lead_id).eq('organization_id', orgId)
  }

  // Delete Google Calendar event if exists (non-blocking, org-fenced read)
  Promise.allSettled([
    (async () => {
      const { data: aptData } = await admin
        .from('appointments')
        .select('external_calendar_id, doctor_id')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single()
      if (aptData?.external_calendar_id && aptData?.doctor_id) {
        await deleteGoogleCalendarEvent(aptData.doctor_id, aptData.external_calendar_id)
      }
    })(),
  ]).catch(() => {})

  // Send cancellation email (non-blocking) — solo tras pasar el check de tenant
  if (process.env.RESEND_API_KEY) {
    Promise.allSettled([
      (async () => {
        const apt = await fetchAptForEmail(id, orgId)
        if (!apt) return
        const lead = Array.isArray(apt.lead) ? apt.lead[0] : apt.lead
        const patientEmail = lead?.contact_email
        if (!patientEmail) return
        const org = (Array.isArray(apt.org) ? apt.org[0] : apt.org as any)
        const orgName = org?.name ?? ''
        const orgSlug = org?.slug ?? ''
        const patientName = [lead.contact_name, lead.contact_last_name].filter(Boolean).join(' ') || 'Paciente'
        const feedbackUrl = apt.manage_token ? `https://app.medscale.app/appointment/${apt.manage_token}/feedback` : undefined
        const bookingUrl  = orgSlug ? `https://app.medscale.app/book/${orgSlug}` : undefined
        await resend.emails.send({
          from:    'citas@medscale.app',
          to:      patientEmail,
          subject: `Cita cancelada — ${orgName}`,
          html:    cancellationEmail({
            patientName,
            orgName,
            appointmentTypeName: null,
            date: fmtDate(apt.scheduled_at),
            time: fmtTime(apt.scheduled_at),
            feedbackUrl,
            bookingUrl,
          }),
        })
      })().catch(err => console.error('[email] cancellation error:', err)),
    ])
  }

  return {}
}

export async function logCancellation(
  appointmentId: string,
  reason: string
): Promise<{ error?: string }> {
  const { userId, orgId, role } = await requireOrgContext()
  if (role === 'doctor') throw new Error('FORBIDDEN')

  // Verificar que la cita pertenece a la org antes de escribir en el audit-log.
  const admin = createServiceClient()
  const { data: apt } = await admin
    .from('appointments')
    .select('id')
    .eq('id', appointmentId)
    .eq('organization_id', orgId)
    .single()
  if (!apt) throw new Error('FORBIDDEN')

  await logAppointmentEvent({
    appointmentId,
    eventType: 'cancelled',
    actorType: 'staff',
    performedBy: userId,   // SIEMPRE el usuario de sesión, nunca del body
    note: reason,
  })
  return {}
}

export async function updateAppointmentNotes(
  id: string,
  notes: string
): Promise<{ error?: string }> {
  const { orgId, role } = await requireOrgContext()
  if (role === 'doctor') throw new Error('FORBIDDEN')

  const admin = createServiceClient()
  const { data: updated, error } = await admin
    .from('appointments')
    .update({ notes })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('id')
  if (error) return { error: error.message }
  if (!updated || updated.length === 0) throw new Error('FORBIDDEN')
  revalidatePath('/scheduling/calendar')
  return {}
}

export async function updateAppointmentStatus(
  id: string,
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'confirmed'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const orgId = await getOrgIdFromUser(user.id)
  if (!orgId) return { error: 'Organización no encontrada' }
  const admin = createServiceClient()
  const { error } = await admin
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { error: error.message }

  if (status === 'completed' || status === 'cancelled' || status === 'no_show') {
    const { data: apt } = await admin
      .from('appointments')
      .select('lead_id, manage_token, lead:lead_id(contact_name, contact_last_name, contact_email), org:organization_id(name, slug)')
      .eq('id', id)
      .single()
    if (apt?.lead_id) {
      const leadStatus = status === 'completed' ? 'asistio_a_cita' : 'cancelo_cita'
      await admin.from('leads').update({ status: leadStatus }).eq('id', apt.lead_id)
    }

    // Loguear el cambio de status en el timeline de auditoría
    if (status === 'completed' || status === 'no_show') {
      await logAppointmentEvent({
        appointmentId: id,
        eventType: status,
        actorType: 'staff',
        performedBy: user.id,
        note: status === 'completed' ? 'Cita marcada como completada' : 'Cita marcada como no asistió',
      })
    }

    // Send no-show follow-up email
    if (status === 'no_show' && process.env.RESEND_API_KEY && apt) {
      Promise.allSettled([
        (async () => {
          const lead = Array.isArray(apt.lead) ? apt.lead[0] : apt.lead as any
          const org  = Array.isArray(apt.org)  ? apt.org[0]  : apt.org  as any
          const patientEmail = lead?.contact_email
          if (!patientEmail) return
          const patientName = [lead?.contact_name, lead?.contact_last_name].filter(Boolean).join(' ') || 'Paciente'
          const orgName     = org?.name ?? ''
          const orgSlug     = org?.slug ?? ''
          const feedbackUrl = apt.manage_token ? `https://app.medscale.app/appointment/${apt.manage_token}/feedback` : ''
          const bookingUrl  = orgSlug ? `https://app.medscale.app/book/${orgSlug}` : ''
          if (!feedbackUrl) return
          await resend.emails.send({
            from:    'citas@medscale.app',
            to:      patientEmail,
            subject: `¿No pudiste asistir? — ${orgName}`,
            html:    noShowFollowUpEmail({ patientName, orgName, feedbackUrl, bookingUrl }),
          })
        })().catch(err => console.error('[email] no_show follow-up error:', err)),
      ])
    }
  }

  revalidatePath('/scheduling/calendar')
  return {}
}

export async function rescheduleAppointment(
  id: string,
  scheduledAt: string,
  endsAt: string
): Promise<{ error?: string }> {
  const { orgId, role } = await requireOrgContext()
  if (role === 'doctor') throw new Error('FORBIDDEN')

  const admin = createServiceClient()
  // La constraint appointments_no_overlap se sigue evaluando en la DB (aplica
  // con service client igual). El error de solapamiento vuelve en `error` y el
  // caller lo mapea; 0 filas ⇒ cita ajena ⇒ abortar antes del email.
  const { data: updated, error } = await admin
    .from('appointments')
    .update({ scheduled_at: scheduledAt, ends_at: endsAt })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('id')
  if (error) return { error: error.message }
  if (!updated || updated.length === 0) throw new Error('FORBIDDEN')
  revalidatePath('/scheduling/calendar')

  // Send reschedule email (non-blocking) — solo tras pasar el check de tenant
  if (process.env.RESEND_API_KEY) {
    Promise.allSettled([
      (async () => {
        const apt = await fetchAptForEmail(id, orgId)
        if (!apt) return
        const lead = Array.isArray(apt.lead) ? apt.lead[0] : apt.lead
        const patientEmail = lead?.contact_email
        if (!patientEmail) return
        const orgName = (Array.isArray(apt.org) ? apt.org[0] : apt.org as any)?.name ?? ''
        const patientName = [lead.contact_name, lead.contact_last_name].filter(Boolean).join(' ') || 'Paciente'
        await resend.emails.send({
          from:    'citas@medscale.app',
          to:      patientEmail,
          subject: `Cita reagendada — ${orgName}`,
          html:    rescheduleEmail({
            patientName,
            orgName,
            appointmentTypeName: null,
            newDate: fmtDate(scheduledAt),
            newTime: fmtTime(scheduledAt),
          }),
        })
      })().catch(err => console.error('[email] reschedule error:', err)),
    ])
  }

  return {}
}

export type AppointmentLogEntry = {
  id: string
  eventType: string
  actorType: string | null
  actorName: string | null
  note: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export async function getAppointmentLogs(
  appointmentId: string
): Promise<{ logs?: AppointmentLogEntry[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // RLS valida que la cita pertenezca a la org del usuario via join a appointments
  const { data, error } = await supabase
    .from('appointment_logs')
    .select('id, event_type, actor_type, note, metadata, performed_by, created_at')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  // Resolver nombres de staff (performed_by → doctors.metadata.name o email)
  const admin = createServiceClient()
  const staffIds = [...new Set((data ?? [])
    .filter(r => r.actor_type === 'staff' && r.performed_by)
    .map(r => r.performed_by as string))]

  const nameById: Record<string, string> = {}
  if (staffIds.length > 0) {
    const { data: docs } = await admin
      .from('doctors')
      .select('user_id, metadata')
      .in('user_id', staffIds)
    for (const d of docs ?? []) {
      const nm = (d.metadata as Record<string, unknown> | null)?.name
      if (d.user_id && nm) nameById[d.user_id as string] = String(nm)
    }
  }

  const logs: AppointmentLogEntry[] = (data ?? []).map(r => ({
    id: r.id as string,
    eventType: r.event_type as string,
    actorType: (r.actor_type as string | null) ?? null,
    actorName: r.performed_by ? (nameById[r.performed_by as string] ?? null) : null,
    note: (r.note as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string,
  }))

  return { logs }
}
