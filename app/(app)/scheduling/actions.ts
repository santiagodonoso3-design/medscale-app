'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resend } from '@/lib/email/resend'
import { cancellationEmail, rescheduleEmail } from '@/lib/email/templates'
import { deleteGoogleCalendarEvent } from '@/lib/google/calendar'

// ── Email helper (fire-and-forget, never throws) ──────────────────────────────

async function fetchAptForEmail(id: string) {
  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('appointments')
      .select('scheduled_at, lead:lead_id(contact_name, contact_last_name, contact_email), org:organization_id(name)')
      .eq('id', id)
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
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/scheduling/calendar')

  // Delete Google Calendar event if exists (non-blocking)
  Promise.allSettled([
    (async () => {
      const admin = createServiceClient()
      const { data: aptData } = await admin
        .from('appointments')
        .select('external_calendar_id, doctor_id')
        .eq('id', id)
        .single()
      if (aptData?.external_calendar_id && aptData?.doctor_id) {
        await deleteGoogleCalendarEvent(aptData.doctor_id, aptData.external_calendar_id)
      }
    })(),
  ]).catch(() => {})

  // Send cancellation email (non-blocking)
  if (process.env.RESEND_API_KEY) {
    Promise.allSettled([
      (async () => {
        const apt = await fetchAptForEmail(id)
        if (!apt) return
        const lead = Array.isArray(apt.lead) ? apt.lead[0] : apt.lead
        const patientEmail = lead?.contact_email
        if (!patientEmail) return
        const orgName = (Array.isArray(apt.org) ? apt.org[0] : apt.org as any)?.name ?? ''
        const patientName = [lead.contact_name, lead.contact_last_name].filter(Boolean).join(' ') || 'Paciente'
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
          }),
        })
      })().catch(err => console.error('[email] cancellation error:', err)),
    ])
  }

  return {}
}

export async function logCancellation(
  appointmentId: string,
  reason: string,
  userId: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('appointment_logs').insert({
    appointment_id: appointmentId,
    event_type: 'cancelled',
    note: reason,
    performed_by: userId ?? null,
  })
  if (error) return { error: error.message }
  return {}
}

export async function updateAppointmentNotes(
  id: string,
  notes: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ notes })
    .eq('id', id)
  if (error) return { error: error.message }
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
  const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { error: 'Organización no encontrada' }
  const admin = createServiceClient()
  const { error } = await admin
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidatePath('/scheduling/calendar')
  return {}
}

export async function rescheduleAppointment(
  id: string,
  scheduledAt: string,
  endsAt: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ scheduled_at: scheduledAt, ends_at: endsAt })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/scheduling/calendar')

  // Send reschedule email (non-blocking)
  if (process.env.RESEND_API_KEY) {
    Promise.allSettled([
      (async () => {
        const apt = await fetchAptForEmail(id)
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
