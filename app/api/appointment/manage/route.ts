import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'
import { cancellationEmail, rescheduleEmail } from '@/lib/email/templates'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function PATCH(request: Request) {
  try {
    const { token, action, new_date, new_time, cancel_reason } = await request.json()

    if (!token || !action) return json({ success: false, error: 'Faltan parámetros' }, 400)

    const { data: apt, error: fetchErr } = await admin
      .from('appointments')
      .select(`
        id, scheduled_at, ends_at, status, notes, manage_token, organization_id,
        doctor:doctor_id(metadata),
        lead:lead_id(contact_name, contact_last_name, contact_email),
        org:organization_id(name)
      `)
      .eq('manage_token', token)
      .single()

    if (fetchErr || !apt) return json({ success: false, error: 'Cita no encontrada' }, 404)
    if (apt.status === 'cancelled') return json({ success: false, error: 'La cita ya fue cancelada' }, 400)

    const { data: orgData } = await admin
      .from('organizations')
      .select('contact_email')
      .eq('id', apt.organization_id)
      .single()

    const lead     = Array.isArray(apt.lead)   ? apt.lead[0]   : apt.lead
    const org      = Array.isArray(apt.org)    ? apt.org[0]    : apt.org
    const doctor   = Array.isArray(apt.doctor) ? apt.doctor[0] : apt.doctor
    const orgName     = (org as any)?.name ?? ''
    const clinicEmail = orgData?.contact_email as string | null
    const patientEmail = lead?.contact_email
    const patientName  = [lead?.contact_name, lead?.contact_last_name].filter(Boolean).join(' ') || 'Paciente'
    const doctorName   = doctor?.metadata ? String((doctor.metadata as any).name ?? '') : null

    const fmtDate = (iso: string) =>
      new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(iso))
    const fmtTime = (iso: string) =>
      new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso))

    if (action === 'reschedule') {
      if (!new_date || !new_time) return json({ success: false, error: 'Fecha y hora requeridas' }, 400)

      const newScheduledAt = new Date(`${new_date}T${new_time}:00.000Z`)
      const originalDuration = apt.ends_at
        ? new Date(apt.ends_at).getTime() - new Date(apt.scheduled_at).getTime()
        : 30 * 60000
      const newEndsAt = new Date(newScheduledAt.getTime() + originalDuration)

      const { error: updErr } = await admin
        .from('appointments')
        .update({ scheduled_at: newScheduledAt.toISOString(), ends_at: newEndsAt.toISOString(), status: 'scheduled' })
        .eq('id', apt.id)
      if (updErr) return json({ success: false, error: updErr.message }, 500)

      await admin.from('appointment_logs').insert({
        appointment_id: apt.id,
        event_type: 'rescheduled',
        note: 'Reagendado por el paciente',
        performed_by: null,
      })

      if (patientEmail && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'citas@medscale.app',
          to:   patientEmail,
          subject: `Cita reagendada — ${orgName}`,
          html: rescheduleEmail({
            patientName, orgName, appointmentTypeName: null,
            newDate: fmtDate(newScheduledAt.toISOString()),
            newTime: fmtTime(newScheduledAt.toISOString()),
          }),
        }).catch(err => console.error('[manage] reschedule email error:', err))
      }

      if (clinicEmail && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'citas@medscale.app',
          to: clinicEmail,
          subject: `Cita reagendada — ${patientName} · ${fmtDate(newScheduledAt.toISOString())}`,
          html: rescheduleEmail({
            patientName, orgName, appointmentTypeName: null,
            newDate: fmtDate(newScheduledAt.toISOString()),
            newTime: fmtTime(newScheduledAt.toISOString()),
          }),
        }).catch(err => console.error('[manage] reschedule clinic email error:', err))
      }

      return json({ success: true, scheduled_at: newScheduledAt.toISOString() })
    }

    if (action === 'cancel') {
      if (!cancel_reason || cancel_reason.trim().length < 10)
        return json({ success: false, error: 'Motivo de cancelación requerido (mínimo 10 caracteres)' }, 400)

      const { error: updErr } = await admin
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', apt.id)
      if (updErr) return json({ success: false, error: updErr.message }, 500)

      await admin.from('appointment_logs').insert({
        appointment_id: apt.id,
        event_type: 'cancelled',
        note: cancel_reason.trim(),
        performed_by: 'patient',
      })

      if (patientEmail && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'citas@medscale.app',
          to:   patientEmail,
          subject: `Cita cancelada — ${orgName}`,
          html: cancellationEmail({
            patientName, orgName, appointmentTypeName: null,
            date: fmtDate(apt.scheduled_at),
            time: fmtTime(apt.scheduled_at),
          }),
        }).catch(err => console.error('[manage] cancel email error:', err))
      }

      if (clinicEmail && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'citas@medscale.app',
          to: clinicEmail,
          subject: `Cita cancelada — ${patientName}`,
          html: cancellationEmail({
            patientName, orgName, appointmentTypeName: null,
            date: fmtDate(apt.scheduled_at),
            time: fmtTime(apt.scheduled_at),
          }),
        }).catch(err => console.error('[manage] cancel clinic email error:', err))
      }

      return json({ success: true })
    }

    return json({ success: false, error: 'Acción no válida' }, 400)
  } catch (err) {
    console.error('[/api/appointment/manage] error:', err)
    return json({ success: false, error: 'Error interno' }, 500)
  }
}
