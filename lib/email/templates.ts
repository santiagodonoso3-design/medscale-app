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
  manageUrl?: string        // link to /appointment/[token]/manage
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

export function bookingConfirmationPatient(p: BookingEmailParams, brand?: EmailBrand): string {
  const lang   = p.language ?? 'es'
  const isEs   = lang !== 'en'

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

  const bodyHtml = `<h1 style="${SG};font-size:24px;font-weight:700;color:${C.fg};margin:0 0 20px;text-align:center">${heading}</h1><div style="text-align:left"><p style="${IN};font-size:15px;color:${C.muted};margin:0 0 8px;line-height:1.6">${isEs ? `Hola <strong style="color:${C.fg}">${p.patientName}</strong>,` : `Hi <strong style="color:${C.fg}">${p.patientName}</strong>,`}</p><p style="${IN};font-size:15px;color:${C.muted};margin:0 0 28px;line-height:1.6">${isEs ? `Tu cita en <strong style="color:${C.fg}">${p.orgName}</strong> ha sido confirmada.` : `Your appointment at <strong style="color:${C.fg}">${p.orgName}</strong> has been confirmed.`}</p></div><div style="border:1px solid ${C.border};border-radius:12px;overflow:hidden"><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid ${C.border}">${cell(lType, typeDisplay)}${cell(lDoctor, doctorDisplay)}</tr><tr style="border-bottom:1px solid ${C.border}">${cell(lDate, p.date)}${cell(lTime, time12)}</tr><tr${addressDisplay && p.modality !== 'virtual' ? ` style="border-bottom:1px solid ${C.border}"` : ''}>${cell(lModality, modalityDisplay)}<td></td></tr>${addressDisplay && p.modality !== 'virtual' ? `<tr>${cell(lAddress, addressDisplay)}<td></td></tr>` : ''}${priceDisplay ? `<tr>${cell(lValor, `${priceDisplay}<br/><span style="font-size:11px;color:${C.muted}">${lValorNote}</span>`)}<td></td></tr>` : ''}</table></div>${p.manageUrl ? `<div style="text-align:center;margin-top:28px;display:flex;gap:12px;justify-content:center"><a href="${p.manageUrl}" style="display:inline-block;background:#215F73;color:#ffffff;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">Reagendar cita</a><a href="${p.manageUrl}?action=cancel" style="display:inline-block;background:#ffffff;color:#DC3545;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;border:1.5px solid #DC3545">Cancelar cita</a></div>` : ''}<p style="margin:28px 0 0;font-size:11px;color:${C.muted};${IN};text-align:center">${footerNote}</p>`

  return brandShell(lang, p.orgName, bodyHtml, { ...brand, primaryColor: brand?.primaryColor ?? p.typeColor ?? null })
}

// ── Shared brand shell helper (collapsed HTML, same as confirmation) ─────────

export interface EmailBrand {
  logoUrl?: string | null
  primaryColor?: string | null
  contactPhone?: string | null
  city?: string | null
}

// White-label: el correo es de la clínica — MedScale no aparece en ninguna
// parte del correo al paciente.
export function brandShell(lang: string, orgName: string, bodyHtml: string, brand?: EmailBrand): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  const accentColor = brand?.primaryColor ?? C.primary
  const headerBlock = brand?.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${orgName}" style="max-height:64px;max-width:220px;height:auto;width:auto;display:block;margin:0 auto;" /><p style="margin:10px 0 0;${IN};font-size:13px;font-weight:500;color:${C.muted}">${orgName}</p>`
    : `<p style="margin:0;${SG};font-size:22px;font-weight:600;color:${C.fg}">${orgName}</p>`
  const contactLine = [brand?.contactPhone, brand?.city].filter(Boolean).join(' · ')
  const footerBlock = `<p style="margin:0;font-size:11px;color:${C.muted};${IN}">${orgName}</p>${contactLine ? `<p style="margin:4px 0 0;font-size:11px;color:${C.muted};${IN}">${contactLine}</p>` : ''}`
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:${C.bg};${IN}"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:${C.card};border-radius:16px 16px 0 0;border:1px solid ${C.border};border-bottom:none;padding:32px 36px 0;text-align:center">${headerBlock}<div style="height:4px;background:${accentColor};margin:20px -36px 0"></div></div><div style="background:${C.card};border:1px solid ${C.border};border-top:none;border-bottom:none;padding:32px 36px">${bodyHtml}</div><div style="background:${C.bg};border:1px solid ${C.border};border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center">${footerBlock}</div></div></body></html>`
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
  feedbackUrl?: string
  bookingUrl?: string
}

export function cancellationEmail(p: SimpleEmailParams, brand?: EmailBrand): string {
  const lang = p.language ?? 'es'
  const isEs = lang !== 'en'
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  const heading  = isEs ? 'Tu cita ha sido cancelada' : 'Your appointment has been cancelled'
  const body     = isEs
    ? `Hola <strong>${p.patientName}</strong>, tu cita en <strong>${p.orgName}</strong> ha sido cancelada. Si deseas reagendar, contacta a la clínica directamente.`
    : `Hi <strong>${p.patientName}</strong>, your appointment at <strong>${p.orgName}</strong> has been cancelled. To reschedule, please contact the clinic directly.`
  const lType    = isEs ? 'Tipo de cita' : 'Appointment type'
  const lDate    = isEs ? 'Fecha'        : 'Date'
  const lTime    = isEs ? 'Hora'         : 'Time'
  const typeRow  = p.appointmentTypeName ? `<tr style="border-bottom:1px solid ${C.border}">${apptCell(lType, p.appointmentTypeName)}<td></td></tr>` : ''

  const ctaSection = (p.feedbackUrl && p.bookingUrl) ? `
    <hr style="border:none;border-top:1px solid ${C.border};margin:24px 0"/>
    <p style="${IN};font-size:14px;color:${C.muted};margin:0 0 12px;text-align:center">¿Nos ayudas a mejorar?</p>
    <div style="text-align:center;margin-bottom:16px">
      <a href="${p.feedbackUrl}" style="display:inline-block;background:${C.primary};color:#ffffff;${SG};font-size:14px;font-weight:600;padding:11px 28px;border-radius:10px;text-decoration:none">Cuéntanos la razón</a>
    </div>
    <p style="${IN};font-size:14px;color:${C.muted};margin:0 0 12px;text-align:center">¿Quieres reagendar?</p>
    <div style="text-align:center">
      <a href="${p.bookingUrl}" style="display:inline-block;background:#ffffff;color:${C.primary};border:1.5px solid ${C.primary};${SG};font-size:14px;font-weight:600;padding:10px 28px;border-radius:10px;text-decoration:none">Reagendar cita</a>
    </div>
  ` : ''

  const bodyHtml = `<h1 style="${SG};font-size:22px;font-weight:700;color:#DC3545;margin:0 0 16px">${heading}</h1><p style="${IN};font-size:15px;color:${C.muted};margin:0 0 24px;line-height:1.6">${body}</p><div style="border:1px solid ${C.border};border-radius:12px;overflow:hidden"><table style="width:100%;border-collapse:collapse">${typeRow}<tr>${apptCell(lDate, p.date)}${apptCell(lTime, p.time)}</tr></table></div>${ctaSection}`
  // El acento rojo es color de estado (cancelación), no de marca — se conserva
  return brandShell(lang, p.orgName, bodyHtml, { ...brand, primaryColor: '#DC3545' })
}

// ── No-show follow-up email ───────────────────────────────────────────────────

export function noShowFollowUpEmail(p: {
  patientName: string
  orgName: string
  feedbackUrl: string
  bookingUrl: string
}, brand?: EmailBrand): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  const bodyHtml = `
    <h1 style="${SG};font-size:22px;font-weight:700;color:${C.fg};margin:0 0 16px;text-align:center">¿No pudiste asistir a tu cita?</h1>
    <p style="${IN};font-size:15px;color:${C.muted};margin:0 0 24px;line-height:1.6">
      Hola <strong style="color:${C.fg}">${p.patientName}</strong>, notamos que no pudiste asistir a tu cita en
      <strong style="color:${C.fg}">${p.orgName}</strong>. No te preocupes, queremos ayudarte.
    </p>
    <div style="text-align:center;margin-bottom:28px">
      <a href="${p.feedbackUrl}"
         style="display:inline-block;background:${C.primary};color:#ffffff;${SG};font-size:14px;font-weight:600;padding:12px 32px;border-radius:10px;text-decoration:none">
        Cuéntanos qué pasó
      </a>
    </div>
    <hr style="border:none;border-top:1px solid ${C.border};margin:24px 0"/>
    <p style="${IN};font-size:14px;color:${C.muted};margin:0 0 16px;text-align:center">¿Quieres reagendar tu cita?</p>
    <div style="text-align:center">
      <a href="${p.bookingUrl}"
         style="display:inline-block;background:#ffffff;color:${C.primary};border:1.5px solid ${C.primary};${SG};font-size:14px;font-weight:600;padding:10px 28px;border-radius:10px;text-decoration:none">
        Reagendar cita
      </a>
    </div>
  `
  return brandShell('es', p.orgName, bodyHtml, brand)
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

export function rescheduleEmail(p: RescheduleEmailParams, brand?: EmailBrand): string {
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
  return brandShell(lang, p.orgName, bodyHtml, brand)
}

// ── Clinic booking notification ───────────────────────────────────────────────

export function bookingNotificationClinic(p: {
  patientName: string
  patientPhone: string
  patientEmail?: string | null
  patientCedula?: string | null
  doctorName: string | null
  date: string
  time: string
  modality: string
  orgName: string
  appointmentTypeName: string | null
  customFields?: Record<string, string> | null
}): string {
  const modalityDisplay = p.modality === 'virtual' ? 'Virtual (videollamada)' : 'Presencial'
  const doctorDisplay   = p.doctorName ?? 'Por asignar'
  const typeDisplay     = p.appointmentTypeName ?? 'Consulta'

  const customFieldsSection = (() => {
    const fields = p.customFields ? Object.entries(p.customFields).filter(([, v]) => v) : []
    if (fields.length === 0) return ''
    return `<hr style="${DIVIDER}" /><p style="${LABEL}">Información adicional</p>${fields.map(([k, v]) => row(k, v)).join('')}`
  })()

  return `<!DOCTYPE html><html><body style="${BASE}">
    <div style="${CARD}">
      <div style="${HEADER}">
        <img src="https://app.medscale.app/logo-white.png" alt="MedScale AI" height="28" style="height:28px;width:auto;display:block;margin:0 auto 12px;" />
        <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8">Nueva cita agendada</p>
        <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff">${p.orgName}</p>
      </div>
      <div style="${BODY}">
        ${row('Paciente', p.patientName)}
        ${row('Teléfono', p.patientPhone)}
        ${p.patientEmail ? row('Email', p.patientEmail) : ''}
        ${p.patientCedula ? row('Cédula', p.patientCedula) : ''}
        <hr style="${DIVIDER}" />
        ${row('Tipo de cita', typeDisplay)}
        ${row('Médico asignado', doctorDisplay)}
        ${row('Fecha', p.date)}
        ${row('Hora', p.time)}
        ${row('Modalidad', modalityDisplay)}
        ${customFieldsSection}
      </div>
      <div style="${FOOTER}">MedScale AI · Notificación interna</div>
    </div>
  </body></html>`
}

// ── Team invitation email ─────────────────────────────────────────────────────

// Shell con marca MedScale para correos a USUARIOS DE LA PLATAFORMA (no
// pacientes): réplica exacta del shell pre-white-label, para que estos correos
// no cambien. No exportar — los correos a paciente usan brandShell.
function medscaleShell(lang: string, orgName: string, bodyHtml: string, accentColor = C.primary): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:${C.bg};${IN}"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:${C.card};border-radius:16px 16px 0 0;border:1px solid ${C.border};border-bottom:none;padding:32px 36px 0;text-align:center"><div style="margin-bottom:16px"><img src="https://app.medscale.app/logo-dark.png" alt="MedScale AI" height="36" style="height:36px;width:auto;display:block;margin:0 auto 8px;" /><p style="margin:4px 0 0;font-size:9px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${C.accent}">FOR HEALTHCARE GROWTH</p></div><p style="margin:0;${SG};font-size:20px;font-weight:600;color:${C.fg}">${orgName}</p><div style="height:4px;background:${accentColor};margin:20px -36px 0"></div></div><div style="background:${C.card};border:1px solid ${C.border};border-top:none;border-bottom:none;padding:32px 36px">${bodyHtml}</div><div style="background:${C.bg};border:1px solid ${C.border};border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center"><p style="margin:0;font-size:11px;color:${C.muted};${IN}">Powered by <strong style="color:${C.fg}">MedScale AI</strong> · medscale.app</p></div></div></body></html>`
}

interface InvitationEmailParams {
  orgName: string
  inviteLink: string
  role: string
}

const ROLE_DISPLAY: Record<string, string> = {
  owner:  'Administrador',
  staff:  'Colaborador',
  doctor: 'Médico',
}

export function invitationEmail(p: InvitationEmailParams): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  const roleDisplay = ROLE_DISPLAY[p.role] ?? p.role

  const bodyHtml = `
    <h1 style="${SG};font-size:24px;font-weight:700;color:${C.fg};margin:0 0 16px;text-align:center">
      Te han invitado a unirte
    </h1>
    <p style="${IN};font-size:15px;color:${C.muted};margin:0 0 28px;line-height:1.6;text-align:center">
      Has sido invitado a unirte a <strong style="color:${C.fg}">${p.orgName}</strong>
      en MedScale AI como <strong style="color:${C.fg}">${roleDisplay}</strong>.
    </p>
    <div style="text-align:center;margin-bottom:28px">
      <a href="${p.inviteLink}"
         style="display:inline-block;background:${C.primary};color:#ffffff;${SG};font-size:15px;font-weight:600;padding:12px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.01em">
        Aceptar invitación
      </a>
    </div>
    <p style="${IN};font-size:12px;color:${C.muted};text-align:center;margin:0;line-height:1.6">
      Si no esperabas esta invitación, puedes ignorar este correo.<br/>
      El enlace expirará en 24 horas.
    </p>
  `
  return medscaleShell('es', p.orgName, bodyHtml)
}

// ── Internal clinic notification (legacy) ─────────────────────────────────────

export function bookingNotificationDoctor(p: BookingEmailParams): string {
  const doctorDisplay   = p.doctorName ?? 'Por asignar'
  const modalityDisplay = p.modality === 'virtual' ? 'Virtual' : 'Presencial'

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="${BASE}">
<div style="${CARD}">
  <div style="${HEADER}">
    <img src="https://app.medscale.app/logo-white.png" alt="MedScale AI" height="28" style="height:28px;width:auto;display:block;margin:0 auto 12px;" />
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

// ── Generic automation email ───────────────────────────────────────────────────

export function automationEmail(
  orgName: string,
  bodyText: string,
  ctaButton?: { label: string; url: string },
  brand?: EmailBrand,
): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`

  const paragraphs = bodyText
    .split('\n')
    .map(line =>
      line.trim()
        ? `<p style="${IN};font-size:15px;color:${C.muted};margin:0 0 14px;line-height:1.7">${line}</p>`
        : '<div style="margin:8px 0"></div>'
    )
    .join('')

  const cta = ctaButton
    ? `<div style="text-align:center;margin-top:24px"><a href="${ctaButton.url}" style="display:inline-block;background:${brand?.primaryColor ?? C.primary};color:#ffffff;${SG};font-size:14px;font-weight:600;padding:12px 32px;border-radius:10px;text-decoration:none">${ctaButton.label}</a></div>`
    : ''

  return brandShell('es', orgName, paragraphs + cta, brand)
}
