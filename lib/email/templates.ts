interface BookingEmailParams {
  patientName: string
  doctorName: string | null
  date: string        // formatted: e.g. "martes 12 de mayo de 2026"
  time: string        // e.g. "10:00"
  modality: string    // 'presencial' | 'virtual'
  orgName: string
  appointmentTypeName: string | null
  typeColor?: string  // hex color for accent bar, default #3B82F6
  language?: string   // 'es' | 'en', default 'es'
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const BASE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  background: #f8fafc;
  margin: 0; padding: 0;
`

const CARD = `
  max-width: 520px; margin: 40px auto; background: #ffffff;
  border-radius: 16px; overflow: hidden;
  border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
`

const HEADER = `
  background: #0f172a; padding: 28px 32px; text-align: center;
`

const BODY = `padding: 32px;`

const LABEL = `
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: #94a3b8; margin: 0 0 4px;
`

const VALUE = `font-size: 15px; font-weight: 600; color: #0f172a; margin: 0 0 20px;`

const DIVIDER = `border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;`

const FOOTER = `
  background: #f8fafc; padding: 20px 32px; text-align: center;
  font-size: 12px; color: #94a3b8;
`

function row(label: string, value: string): string {
  return `<p style="${LABEL}">${label}</p><p style="${VALUE}">${value}</p>`
}

// ── Patient confirmation ──────────────────────────────────────────────────────

export function bookingConfirmationPatient(p: BookingEmailParams): string {
  const lang   = p.language ?? 'es'
  const isEs   = lang !== 'en'
  const accent = p.typeColor ?? '#3B82F6'

  const doctorDisplay   = p.doctorName ?? (isEs ? 'Por asignar' : 'To be assigned')
  const modalityDisplay = p.modality === 'virtual'
    ? (isEs ? 'Virtual (videollamada)' : 'Virtual (video call)')
    : (isEs ? 'Presencial' : 'In person')

  // Format time as 12h
  const [hh, mm] = p.time.split(':').map(Number)
  const timeDate = new Date(2000, 0, 1, hh, mm)
  const time12   = timeDate.toLocaleTimeString(isEs ? 'es-CO' : 'en-US', { hour: '2-digit', minute: '2-digit' })

  const heading     = isEs ? '¡Cita confirmada!' : 'Appointment confirmed!'
  const subheading  = isEs
    ? `Hola <strong>${p.patientName}</strong>, tu cita ha sido agendada con éxito.`
    : `Hi <strong>${p.patientName}</strong>, your appointment has been successfully scheduled.`
  const ctaText     = isEs ? 'Ver mi cita' : 'View my appointment'
  const lType       = isEs ? 'Tipo de cita' : 'Appointment type'
  const lDoctor     = isEs ? 'Médico'        : 'Doctor'
  const lDate       = isEs ? 'Fecha'         : 'Date'
  const lTime       = isEs ? 'Hora'          : 'Time'
  const lModality   = isEs ? 'Modalidad'     : 'Modality'
  const footerMain  = isEs
    ? `Si no agendaste esta cita, ignora este mensaje.`
    : `If you didn't schedule this appointment, please ignore this email.`
  const footerSub   = isEs ? p.orgName : p.orgName

  // 2-column grid cell
  const cell = (label: string, value: string) => `
    <td style="padding:12px 16px;vertical-align:top;width:50%">
      <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8">${label}</p>
      <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a">${value}</p>
    </td>`

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f1f5f9;margin:0;padding:0">
<div style="max-width:520px;margin:40px auto;padding:0 16px">

  <!-- Card -->
  <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 12px rgba(0,0,0,0.07)">

    <!-- Accent bar -->
    <div style="height:4px;background:${accent}"></div>

    <!-- Header -->
    <div style="background:#0f172a;padding:28px 32px;text-align:center">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#475569">MEDSCALE</p>
      <p style="margin:6px 0 0;font-size:16px;font-weight:600;color:#ffffff">${p.orgName}</p>
      <h1 style="margin:10px 0 0;font-size:24px;font-weight:700;color:#ffffff">${heading}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="font-size:15px;color:#475569;margin:0 0 28px;line-height:1.6">${subheading}</p>

      <!-- Appointment card -->
      <div style="background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <table style="width:100%;border-collapse:collapse">
          <tr style="border-bottom:1px solid #e2e8f0">
            ${p.appointmentTypeName ? cell(lType, p.appointmentTypeName) : cell(lType, '—')}
            ${cell(lDoctor, doctorDisplay)}
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0">
            ${cell(lDate, p.date)}
            ${cell(lTime, time12)}
          </tr>
          <tr>
            ${cell(lModality, modalityDisplay)}
            <td></td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0 0">
        <a href="#" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:10px">${ctaText}</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#475569">${footerSub}</p>
      <p style="margin:0;font-size:12px;color:#94a3b8">${footerMain}</p>
    </div>

  </div>

  <p style="text-align:center;font-size:11px;color:#94a3b8;margin:16px 0">Powered by <strong>MedScale</strong> · medscale.app</p>
</div>
</body></html>`
}

// ── Internal clinic notification ──────────────────────────────────────────────

export function bookingNotificationDoctor(p: BookingEmailParams): string {
  const doctorDisplay   = p.doctorName ?? 'Por asignar'
  const modalityDisplay = p.modality === 'virtual' ? 'Virtual' : 'Presencial'

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="${BASE}">
<div style="${CARD}">
  <div style="${HEADER}">
    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#64748b">MedScale · Notificación interna</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff">Nueva cita agendada</h1>
  </div>
  <div style="${BODY}">
    <p style="font-size:15px;color:#475569;margin:0 0 24px">
      Se ha registrado una nueva cita en <strong>${p.orgName}</strong>.
    </p>
    <hr style="${DIVIDER}"/>
    ${row('Paciente',    p.patientName)}
    ${p.appointmentTypeName ? row('Tipo de cita', p.appointmentTypeName) : ''}
    ${row('Médico',      doctorDisplay)}
    ${row('Fecha',       p.date)}
    ${row('Hora',        p.time)}
    ${row('Modalidad',   modalityDisplay)}
    <hr style="${DIVIDER}"/>
    <p style="font-size:13px;color:#94a3b8;margin:0">
      Revisa el panel de administración para más detalles.
    </p>
  </div>
  <div style="${FOOTER}">
    <p style="margin:0">Powered by <strong>MedScale</strong> · medscale.app</p>
  </div>
</div>
</body></html>`
}
