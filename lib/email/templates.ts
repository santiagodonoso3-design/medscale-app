interface BookingEmailParams {
  patientName: string
  doctorName: string | null
  date: string        // formatted: e.g. "martes 12 de mayo de 2026"
  time: string        // e.g. "10:00"
  modality: string    // 'presencial' | 'virtual'
  orgName: string
  appointmentTypeName: string | null
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
  const lang = p.language ?? 'es'
  const isEs = lang !== 'en'

  const doctorDisplay = p.doctorName ?? (isEs ? 'Por asignar' : 'To be assigned')
  const modalityDisplay = p.modality === 'virtual'
    ? (isEs ? 'Virtual (videollamada)' : 'Virtual (video call)')
    : (isEs ? 'Presencial' : 'In person')

  const heading   = isEs ? '¡Cita confirmada!' : 'Appointment confirmed!'
  const subheading = isEs
    ? `Tu cita en <strong>${p.orgName}</strong> ha sido agendada.`
    : `Your appointment at <strong>${p.orgName}</strong> has been scheduled.`

  const lType     = isEs ? 'Tipo de cita'   : 'Appointment type'
  const lDoctor   = isEs ? 'Médico'         : 'Doctor'
  const lDate     = isEs ? 'Fecha'          : 'Date'
  const lTime     = isEs ? 'Hora'           : 'Time'
  const lModality = isEs ? 'Modalidad'      : 'Modality'
  const footerNote = isEs
    ? 'Si necesitas cancelar o reagendar, contacta a la clínica directamente.'
    : 'To cancel or reschedule, please contact the clinic directly.'

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="${BASE}">
<div style="${CARD}">
  <div style="${HEADER}">
    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#64748b">MedScale</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#ffffff">${heading}</h1>
  </div>
  <div style="${BODY}">
    <p style="font-size:15px;color:#475569;margin:0 0 24px">${subheading}</p>
    <hr style="${DIVIDER}"/>
    ${p.appointmentTypeName ? row(lType, p.appointmentTypeName) : ''}
    ${row(lDoctor,   doctorDisplay)}
    ${row(lDate,     p.date)}
    ${row(lTime,     p.time)}
    ${row(lModality, modalityDisplay)}
    <hr style="${DIVIDER}"/>
    <p style="font-size:13px;color:#94a3b8;margin:0">${footerNote}</p>
  </div>
  <div style="${FOOTER}">
    <p style="margin:0">Powered by <strong>MedScale</strong> · medscale.app</p>
  </div>
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
