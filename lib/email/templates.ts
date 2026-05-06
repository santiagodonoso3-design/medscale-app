interface BookingEmailParams {
  patientName: string
  doctorName: string | null
  date: string        // formatted: e.g. "martes 12 de mayo de 2026"
  time: string        // e.g. "10:00"
  modality: string    // 'presencial' | 'virtual'
  orgName: string
  appointmentTypeName: string | null
  typeColor?: string        // hex color for accent bar, default #3B82F6
  price?: number | null
  locationAddress?: string | null
  locationCity?: string | null
  language?: string         // 'es' | 'en', default 'es'
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

// ── Brand tokens ──────────────────────────────────────────────────────────────
// MedScale AI brand kit
const C = {
  bg:      '#EBF0F6',
  card:    '#FFFFFF',
  primary: '#215F73',
  accent:  '#5A9DB5',
  fg:      '#0D2B3E',
  muted:   '#4A6B7A',
  border:  '#C8D8E4',
}

// ── Patient confirmation ──────────────────────────────────────────────────────

export function bookingConfirmationPatient(p: BookingEmailParams): string {
  const lang   = p.language ?? 'es'
  const isEs   = lang !== 'en'
  const accent = p.typeColor ?? C.primary

  const typeDisplay     = p.appointmentTypeName ?? (isEs ? 'Consulta' : 'Consultation')
  const doctorDisplay   = p.doctorName ?? (isEs ? 'Por asignar' : 'To be assigned')
  const modalityDisplay = p.modality === 'virtual'
    ? (isEs ? 'Virtual (videollamada)' : 'Virtual (video call)')
    : (isEs ? 'Presencial' : 'In person')

  const [hh, mm] = p.time.split(':').map(Number)
  const time12   = new Date(2000, 0, 1, hh, mm).toLocaleTimeString(isEs ? 'es-CO' : 'en-US', { hour: '2-digit', minute: '2-digit' })

  const heading    = isEs ? '¡Cita confirmada!' : 'Appointment confirmed!'
  const lType      = isEs ? 'Tipo de cita' : 'Appointment type'
  const lDoctor    = isEs ? 'Médico'        : 'Doctor'
  const lDate      = isEs ? 'Fecha'         : 'Date'
  const lTime      = isEs ? 'Hora'          : 'Time'
  const lModality  = isEs ? 'Modalidad'     : 'Modality'
  const lAddress   = isEs ? 'Dirección'     : 'Address'
  const lValor     = isEs ? 'Valor'         : 'Fee'
  const lValorNote = isEs ? 'Se paga en el consultorio' : 'Payable at the clinic'
  const footerNote = isEs ? 'Si no agendaste esta cita, ignora este mensaje.' : "If you didn't schedule this appointment, please ignore this email."

  const addressDisplay = p.locationAddress ? [p.locationAddress, p.locationCity].filter(Boolean).join(', ') : null
  const priceDisplay   = p.price && p.price > 0
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.price)
    : null

  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`

  const cell = (label: string, value: string) =>
    `<td style="padding:14px 18px;vertical-align:top;width:50%;${IN}"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.accent}">${label}</p><p style="margin:0;font-size:14px;font-weight:600;color:${C.fg};${SG}">${value}</p></td>`

  const checkSvg = ``

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:${C.bg};${IN}"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:${C.card};border-radius:16px 16px 0 0;border:1px solid ${C.border};border-bottom:none;padding:32px 36px 0;text-align:center"><div style="margin-bottom:16px"><span style="${SG};font-size:22px;font-weight:700;letter-spacing:-0.01em"><span style="color:${C.muted}">MED</span><span style="color:${C.fg}">SCALE AI</span></span><p style="margin:4px 0 0;font-size:9px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${C.accent}">FOR HEALTHCARE GROWTH</p></div><p style="margin:0;${SG};font-size:20px;font-weight:600;color:${C.fg}">${p.orgName}</p><div style="height:4px;background:${accent};margin:20px -36px 0"></div></div><div style="background:${C.card};border:1px solid ${C.border};border-top:none;border-bottom:none;padding:32px 36px;text-align:center">${checkSvg}<h1 style="${SG};font-size:24px;font-weight:700;color:${C.fg};margin:0 0 20px;text-align:center">${heading}</h1><div style="text-align:left"><p style="${IN};font-size:15px;color:${C.muted};margin:0 0 8px;line-height:1.6">${isEs ? `Hola <strong style="color:${C.fg}">${p.patientName}</strong>,` : `Hi <strong style="color:${C.fg}">${p.patientName}</strong>,`}</p><p style="${IN};font-size:15px;color:${C.muted};margin:0 0 28px;line-height:1.6">${isEs ? `Tu cita en <strong style="color:${C.fg}">${p.orgName}</strong> ha sido confirmada.` : `Your appointment at <strong style="color:${C.fg}">${p.orgName}</strong> has been confirmed.`}</p></div><div style="border:1px solid ${C.border};border-radius:12px;overflow:hidden"><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid ${C.border}">${cell(lType, typeDisplay)}${cell(lDoctor, doctorDisplay)}</tr><tr style="border-bottom:1px solid ${C.border}">${cell(lDate, p.date)}${cell(lTime, time12)}</tr><tr${addressDisplay && p.modality !== 'virtual' ? ` style="border-bottom:1px solid ${C.border}"` : ''}>${cell(lModality, modalityDisplay)}<td></td></tr>${addressDisplay && p.modality !== 'virtual' ? `<tr>${cell(lAddress, addressDisplay)}<td></td></tr>` : ''}${priceDisplay ? `<tr>${cell(lValor, `${priceDisplay}<br/><span style="font-size:11px;color:${C.muted}">${lValorNote}</span>`)}<td></td></tr>` : ''}</table></div></div><div style="background:${C.bg};border:1px solid ${C.border};border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center"><p style="margin:0 0 4px;font-size:11px;color:${C.muted};${IN}">Powered by <strong style="color:${C.fg}">MedScale AI</strong> · medscale.app</p><p style="margin:0;font-size:11px;color:${C.muted};${IN}">${footerNote}</p></div></div></body></html>`
}

// ── Shared brand shell helper (collapsed HTML, same as confirmation) ─────────

function brandShell(lang: string, orgName: string, bodyHtml: string, accentColor = C.primary): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:${C.bg};${IN}"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:${C.card};border-radius:16px 16px 0 0;border:1px solid ${C.border};border-bottom:none;padding:32px 36px 0;text-align:center"><div style="margin-bottom:16px"><span style="${SG};font-size:22px;font-weight:700;letter-spacing:-0.01em"><span style="color:${C.muted}">MED</span><span style="color:${C.fg}">SCALE AI</span></span><p style="margin:4px 0 0;font-size:9px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${C.accent}">FOR HEALTHCARE GROWTH</p></div><p style="margin:0;${SG};font-size:20px;font-weight:600;color:${C.fg}">${orgName}</p><div style="height:4px;background:${accentColor};margin:20px -36px 0"></div></div><div style="background:${C.card};border:1px solid ${C.border};border-top:none;border-bottom:none;padding:32px 36px">${bodyHtml}</div><div style="background:${C.bg};border:1px solid ${C.border};border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center"><p style="margin:0;font-size:11px;color:${C.muted};${IN}">Powered by <strong style="color:${C.fg}">MedScale AI</strong> · medscale.app</p></div></div></body></html>`
}

function apptCell(label: string, value: string): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  return `<td style="padding:14px 18px;vertical-align:top;width:50%;${IN}"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.accent}">${label}</p><p style="margin:0;font-size:14px;font-weight:600;color:${C.fg};${SG}">${value}</p></td>`
}

// ── Cancellation notification ─────────────────────────────────────────────────

interface SimpleEmailParams {
  patientName: string
  orgName: string
  appointmentTypeName: string | null
  date: string
  time: string
  language?: string
}

export function cancellationEmail(p: SimpleEmailParams): string {
  const lang = p.language ?? 'es'
  const isEs = lang !== 'en'
  const heading  = isEs ? 'Tu cita ha sido cancelada' : 'Your appointment has been cancelled'
  const body     = isEs
    ? `Hola <strong>${p.patientName}</strong>, tu cita en <strong>${p.orgName}</strong> ha sido cancelada. Si deseas reagendar, contacta a la clínica directamente.`
    : `Hi <strong>${p.patientName}</strong>, your appointment at <strong>${p.orgName}</strong> has been cancelled. To reschedule, please contact the clinic directly.`
  const lType    = isEs ? 'Tipo de cita' : 'Appointment type'
  const lDate    = isEs ? 'Fecha'        : 'Date'
  const lTime    = isEs ? 'Hora'         : 'Time'
  const typeRow  = p.appointmentTypeName ? `<tr style="border-bottom:1px solid ${C.border}">${apptCell(lType, p.appointmentTypeName)}<td></td></tr>` : ''
  const bodyHtml = `<h1 style="font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#DC3545;margin:0 0 16px">${heading}</h1><p style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;color:${C.muted};margin:0 0 24px;line-height:1.6">${body}</p><div style="border:1px solid ${C.border};border-radius:12px;overflow:hidden"><table style="width:100%;border-collapse:collapse">${typeRow}<tr>${apptCell(lDate, p.date)}${apptCell(lTime, p.time)}</tr></table></div>`
  return brandShell(lang, p.orgName, bodyHtml, '#DC3545')
}

// ── Reschedule notification ───────────────────────────────────────────────────

interface RescheduleEmailParams {
  patientName: string
  orgName: string
  appointmentTypeName: string | null
  newDate: string
  newTime: string
  language?: string
}

export function rescheduleEmail(p: RescheduleEmailParams): string {
  const lang = p.language ?? 'es'
  const isEs = lang !== 'en'
  const heading  = isEs ? 'Tu cita ha sido reagendada' : 'Your appointment has been rescheduled'
  const body     = isEs
    ? `Hola <strong>${p.patientName}</strong>, tu cita en <strong>${p.orgName}</strong> ha sido reagendada para la siguiente fecha y hora.`
    : `Hi <strong>${p.patientName}</strong>, your appointment at <strong>${p.orgName}</strong> has been rescheduled to the following date and time.`
  const lType    = isEs ? 'Tipo de cita'  : 'Appointment type'
  const lNewDate = isEs ? 'Nueva fecha'   : 'New date'
  const lNewTime = isEs ? 'Nueva hora'    : 'New time'
  const typeRow  = p.appointmentTypeName ? `<tr style="border-bottom:1px solid ${C.border}">${apptCell(lType, p.appointmentTypeName)}<td></td></tr>` : ''
  const bodyHtml = `<h1 style="font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:${C.fg};margin:0 0 16px">${heading}</h1><p style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;color:${C.muted};margin:0 0 24px;line-height:1.6">${body}</p><div style="border:1px solid ${C.border};border-radius:12px;overflow:hidden"><table style="width:100%;border-collapse:collapse">${typeRow}<tr>${apptCell(lNewDate, p.newDate)}${apptCell(lNewTime, p.newTime)}</tr></table></div>`
  return brandShell(lang, p.orgName, bodyHtml, C.primary)
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
