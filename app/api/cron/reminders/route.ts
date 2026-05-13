import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'
import { brandShell } from '@/lib/email/templates'

const C = {
  fg:     '#0D2B3E',
  muted:  '#4A6B7A',
  accent: '#5A9DB5',
  border: '#C8D8E4',
}

function reminderBody(patientName: string, doctorName: string, date: string, time: string, typeName: string | null): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  const cell = (label: string, value: string) =>
    `<td style="padding:14px 18px;vertical-align:top;width:50%;${IN}"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.accent}">${label}</p><p style="margin:0;font-size:14px;font-weight:600;color:${C.fg};${SG}">${value}</p></td>`
  const typeRow = typeName
    ? `<tr style="border-bottom:1px solid ${C.border}">${cell('Tipo de cita', typeName)}<td></td></tr>`
    : ''
  return `
    <h1 style="${SG};font-size:22px;font-weight:700;color:${C.fg};margin:0 0 16px">Te recordamos tu cita</h1>
    <p style="${IN};font-size:15px;color:${C.muted};margin:0 0 24px;line-height:1.6">
      Hola <strong style="color:${C.fg}">${patientName}</strong>, te recordamos que tienes una cita programada:
    </p>
    <div style="border:1px solid ${C.border};border-radius:12px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        ${typeRow}
        <tr style="border-bottom:1px solid ${C.border}">${cell('Médico', doctorName)}${cell('Fecha', date)}</tr>
        <tr>${cell('Hora', time)}<td></td></tr>
      </table>
    </div>
  `
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: notifications, error: notifError } = await supabaseAdmin
    .from('appointment_type_notifications')
    .select('*')
    .eq('event_type', 'reminder')
    .eq('enabled', true)
    .eq('to_patient', true)

  if (notifError) {
    console.error('[reminders] Error fetching notifications:', notifError)
    return Response.json({ error: notifError.message }, { status: 500 })
  }

  if (!notifications || notifications.length === 0) {
    return Response.json({ sent: 0 })
  }

  let totalSent = 0

  for (const notif of notifications) {
    const now         = new Date()
    const windowStart = new Date(now.getTime() + notif.hours_before * 3600 * 1000)
    const windowEnd   = new Date(windowStart.getTime() + 3600 * 1000)

    const { data: appointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, scheduled_at, modality,
        leads(contact_name, contact_last_name, contact_email),
        doctors(metadata),
        organizations(name),
        appointment_types(name)
      `)
      .eq('appointment_type_id', notif.appointment_type_id)
      .eq('status', 'scheduled')
      .gte('scheduled_at', windowStart.toISOString())
      .lt('scheduled_at', windowEnd.toISOString())
      .is('reminder_sent_at', null)

    if (apptError) {
      console.error(`[reminders] Error fetching appointments for notif ${notif.id}:`, apptError)
      continue
    }

    if (!appointments || appointments.length === 0) continue

    const emailResults = await Promise.allSettled(
      appointments.map(async (appt) => {
        const lead = Array.isArray(appt.leads) ? appt.leads[0] : appt.leads
        const doctor = Array.isArray(appt.doctors) ? appt.doctors[0] : appt.doctors
        const org = Array.isArray(appt.organizations) ? appt.organizations[0] : appt.organizations
        const apptType = Array.isArray(appt.appointment_types) ? appt.appointment_types[0] : appt.appointment_types

        const email = (lead as { contact_email?: string } | null)?.contact_email
        if (!email) return

        const firstName  = (lead as { contact_name?: string } | null)?.contact_name ?? ''
        const lastName   = (lead as { contact_last_name?: string } | null)?.contact_last_name ?? ''
        const patientName = [firstName, lastName].filter(Boolean).join(' ') || 'Paciente'
        const orgName    = (org as { name?: string } | null)?.name ?? 'MedScale'
        const typeName   = (apptType as { name?: string } | null)?.name ?? null
        const meta       = (doctor as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}
        const doctorName = String(meta.name ?? 'Tu médico')

        const scheduledAt = new Date(appt.scheduled_at as string)
        const dateStr = new Intl.DateTimeFormat('es-CO', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
        }).format(scheduledAt)
        const timeStr = new Intl.DateTimeFormat('es-CO', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota',
        }).format(scheduledAt)

        const html = brandShell('es', orgName, reminderBody(patientName, doctorName, dateStr, timeStr, typeName))

        await resend.emails.send({
          from: 'citas@medscale.app',
          to:   email,
          subject: `Recordatorio de cita — ${orgName}`,
          html,
        })

        await supabaseAdmin
          .from('appointments')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', appt.id)

        totalSent++
      })
    )

    const failed = emailResults.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
      console.error(`[reminders] ${failed.length} reminder(s) failed for notif ${notif.id}`)
    }
  }

  return Response.json({ sent: totalSent })
}
