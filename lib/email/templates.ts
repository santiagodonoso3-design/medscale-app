// ── Email templates — "Template B" (white-label) ──────────────────────────────
// Reglas del template:
// - Fuentes de sistema (sin web fonts de ningún tipo).
// - Todo estilo inline, sin bloque de estilos en el head (los clientes de correo lo purgan).
// - Layout en tablas para Gmail (web/mobile), Outlook (desktop/web) y Apple Mail.
// - El correo es de la clínica: logo del cliente protagonista, sin marca MedScale
//   visible al paciente salvo el sello discreto pequeño del footer.

interface BookingEmailParams {
  patientName: string
  doctorName: string | null
  date: string        // formatted: e.g. "martes 12 de mayo de 2026"
  time: string        // e.g. "10:00"
  modality: string    // 'presencial' | 'virtual'
  orgName: string
  appointmentTypeName: string | null
  typeColor?: string        // hex color for accent bar (fallback when the org has no primary_color)
  price?: number | null
  locationAddress?: string | null
  locationCity?: string | null
  language?: string         // 'es' | 'en', default 'es'
  manageUrl?: string        // link to /appointment/[token]/manage
}

// ── Tokens Template B ─────────────────────────────────────────────────────────

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Color de marca por defecto cuando la org no tiene primary_color (gris neutro,
// nunca un azul MedScale)
const DEFAULT_PRIMARY = '#111827'

const T = {
  bg:     '#F5F5F5',
  card:   '#FFFFFF',
  text:   '#1a1a1a',
  muted:  '#666666',
  subtle: '#999999',
  faint:  '#B0B0B0',
  border: '#E5E5E5',
  danger: '#DC3545', // color de estado (cancelación), no de marca
}

const DIVIDER = `border:none;border-top:1px solid ${T.border};margin:20px 0;`

export interface EmailBrand {
  logoUrl?: string | null
  primaryColor?: string | null
  contactEmail?: string | null  // destino del mailto de opt-out
  contactPhone?: string | null
  city?: string | null
}

function accentOf(brand?: EmailBrand): string {
  return brand?.primaryColor ?? DEFAULT_PRIMARY
}

// ── Building blocks ───────────────────────────────────────────────────────────

// CTA principal: fondo = color de marca, texto blanco
function primaryButton(label: string, url: string, color: string): string {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#FFFFFF;${FONT};font-size:14px;font-weight:500;letter-spacing:0.3px;padding:14px 32px;border-radius:8px;text-decoration:none;">${label}</a>`
}

// Botón secundario (outline) en el mismo color
function outlineButton(label: string, url: string, color: string): string {
  return `<a href="${url}" style="display:inline-block;background:#FFFFFF;color:${color};border:1.5px solid ${color};${FONT};font-size:14px;font-weight:500;letter-spacing:0.3px;padding:12px 30px;border-radius:8px;text-decoration:none;">${label}</a>`
}

function h1(text: string, color: string = T.text, align: string = 'left'): string {
  return `<h1 style="margin:0 0 16px;${FONT};font-size:22px;font-weight:600;line-height:1.3;color:${color};text-align:${align};">${text}</h1>`
}

function para(
  html: string,
  opts?: { color?: string; size?: number; align?: string; margin?: string },
): string {
  return `<p style="margin:${opts?.margin ?? '0 0 16px'};${FONT};font-size:${opts?.size ?? 15}px;line-height:1.7;color:${opts?.color ?? T.text};text-align:${opts?.align ?? 'left'};">${html}</p>`
}

// Celda de la tabla de detalle de cita (label + valor)
function apptCell(label: string, value: string): string {
  return `<td style="padding:14px 18px;vertical-align:top;width:50%;"><p style="margin:0 0 4px;${FONT};font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${T.subtle};">${label}</p><p style="margin:0;${FONT};font-size:14px;font-weight:600;color:${T.text};">${value}</p></td>`
}

function detailTable(rowsHtml: string): string {
  return `<div style="border:1px solid ${T.border};border-radius:10px;overflow:hidden;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rowsHtml}</table></div>`
}

const ROW_BORDER = `style="border-bottom:1px solid ${T.border};"`

// Fila label/valor para notificaciones internas (clínica / médico)
function row(label: string, value: string): string {
  return `<p style="margin:0 0 4px;${FONT};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${T.subtle};">${label}</p><p style="margin:0 0 18px;${FONT};font-size:15px;font-weight:600;color:${T.text};">${value}</p>`
}

// ── Shell Template B ──────────────────────────────────────────────────────────
// Única fuente del header (logo del cliente), la accent bar, el footer y el
// el sello del footer. Todos los correos salen por aquí.

export function brandShell(
  lang: string,
  orgName: string,
  bodyHtml: string,
  brand?: EmailBrand,
  options?: { showUnsubscribe?: boolean },
): string {
  const accent = accentOf(brand)

  // Header: logo del cliente protagonista; sin logo, el nombre de la org grande
  const header = brand?.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${orgName}" style="max-height:60px;width:auto;height:auto;display:block;margin:0 auto;border:0;" />`
    : `<p style="margin:0;${FONT};font-size:22px;font-weight:600;color:${T.text};">${orgName}</p>`

  // Opt-out (solo marketing): mailto a la PRIMERA dirección de contact_email
  // (en producción es un CSV con varias). Sin dirección válida no se renderiza
  // el link: mejor sin opt-out que apuntando a un buzón que no lo procesa.
  const unsubscribeEmail = brand?.contactEmail
    ? brand.contactEmail.split(',')[0].trim()
    : null
  const unsubscribe = (options?.showUnsubscribe && unsubscribeEmail)
    ? `<p style="margin:8px 0 0;${FONT};font-size:12px;"><a href="mailto:${unsubscribeEmail}?subject=${encodeURIComponent('Cancelar correos automáticos')}" style="color:${T.subtle};text-decoration:underline;">Cancelar suscripción</a></p>`
    : ''

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${orgName}</title></head><body style="margin:0;padding:0;background:${T.bg};${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.bg};margin:0;padding:0;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${T.card};border-radius:12px;">
<tr><td align="center" style="padding:36px 40px 16px;">${header}</td></tr>
<tr><td align="center" style="padding:0 40px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:48px;height:3px;background:${accent};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:4px 40px 24px;${FONT};font-size:15px;line-height:1.7;color:${T.text};">${bodyHtml}</td></tr>
<tr><td align="center" style="padding:20px 40px 28px;border-top:1px solid ${T.border};"><p style="margin:0;${FONT};font-size:12px;color:${T.muted};">${orgName}</p>${unsubscribe}<p style="margin:12px 0 0;${FONT};font-size:10px;color:${T.faint};">Powered by MedScale AI</p></td></tr>
</table>
</td></tr></table>
</body></html>`
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

  const headingText = isEs ? '¡Cita confirmada!' : 'Appointment confirmed!'
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
  const showAddress    = !!addressDisplay && p.modality !== 'virtual'
  const priceDisplay   = p.price && p.price > 0
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.price)
    : null

  // Marca de la org; si no tiene, el color del tipo de cita; si no, el default neutro
  const accent = brand?.primaryColor ?? p.typeColor ?? DEFAULT_PRIMARY

  const rows = [
    `<tr ${ROW_BORDER}>${apptCell(lType, typeDisplay)}${apptCell(lDoctor, doctorDisplay)}</tr>`,
    `<tr ${ROW_BORDER}>${apptCell(lDate, p.date)}${apptCell(lTime, time12)}</tr>`,
    `<tr ${showAddress || priceDisplay ? ROW_BORDER : ''}>${apptCell(lModality, modalityDisplay)}<td></td></tr>`,
    showAddress ? `<tr ${priceDisplay ? ROW_BORDER : ''}>${apptCell(lAddress, addressDisplay!)}<td></td></tr>` : '',
    priceDisplay ? `<tr>${apptCell(lValor, `${priceDisplay}<br/><span style="font-size:11px;font-weight:400;color:${T.muted};">${lValorNote}</span>`)}<td></td></tr>` : '',
  ].join('')

  const ctaBlock = p.manageUrl
    ? `<div style="text-align:center;margin:28px 0 0;">${primaryButton(isEs ? 'Reagendar cita' : 'Reschedule', p.manageUrl, accent)}<span style="display:inline-block;width:12px;">&nbsp;</span>${outlineButton(isEs ? 'Cancelar cita' : 'Cancel appointment', `${p.manageUrl}?action=cancel`, T.danger)}</div>`
    : ''

  const bodyHtml =
    h1(headingText, T.text, 'center') +
    para(isEs ? `Hola <strong>${p.patientName}</strong>,` : `Hi <strong>${p.patientName}</strong>,`, { margin: '0 0 8px' }) +
    para(isEs ? `Tu cita en <strong>${p.orgName}</strong> ha sido confirmada.` : `Your appointment at <strong>${p.orgName}</strong> has been confirmed.`, { margin: '0 0 24px' }) +
    detailTable(rows) +
    ctaBlock +
    para(footerNote, { color: T.muted, size: 12, align: 'center', margin: '24px 0 0' })

  return brandShell(lang, p.orgName, bodyHtml, { ...brand, primaryColor: accent })
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
  const accent = accentOf(brand)

  const headingText = isEs ? 'Tu cita ha sido cancelada' : 'Your appointment has been cancelled'
  const body        = isEs
    ? `Hola <strong>${p.patientName}</strong>, tu cita en <strong>${p.orgName}</strong> ha sido cancelada. Si deseas reagendar, contacta a la clínica directamente.`
    : `Hi <strong>${p.patientName}</strong>, your appointment at <strong>${p.orgName}</strong> has been cancelled. To reschedule, please contact the clinic directly.`
  const lType   = isEs ? 'Tipo de cita' : 'Appointment type'
  const lDate   = isEs ? 'Fecha'        : 'Date'
  const lTime   = isEs ? 'Hora'         : 'Time'
  const typeRow = p.appointmentTypeName ? `<tr ${ROW_BORDER}>${apptCell(lType, p.appointmentTypeName)}<td></td></tr>` : ''

  const ctaSection = (p.feedbackUrl && p.bookingUrl)
    ? `<hr style="${DIVIDER}"/>` +
      para('¿Nos ayudas a mejorar?', { color: T.muted, size: 14, align: 'center', margin: '0 0 12px' }) +
      `<div style="text-align:center;margin:0 0 20px;">${primaryButton('Cuéntanos la razón', p.feedbackUrl, accent)}</div>` +
      para('¿Quieres reagendar?', { color: T.muted, size: 14, align: 'center', margin: '0 0 12px' }) +
      `<div style="text-align:center;">${outlineButton('Reagendar cita', p.bookingUrl, accent)}</div>`
    : ''

  const bodyHtml =
    h1(headingText, T.danger) +
    para(body, { margin: '0 0 24px' }) +
    detailTable(`${typeRow}<tr>${apptCell(lDate, p.date)}${apptCell(lTime, p.time)}</tr>`) +
    ctaSection

  // La accent bar roja es color de estado (cancelación), no de marca — se conserva.
  // Los botones sí van en el color de marca.
  return brandShell(lang, p.orgName, bodyHtml, { ...brand, primaryColor: T.danger })
}

// ── No-show follow-up email ───────────────────────────────────────────────────

export function noShowFollowUpEmail(p: {
  patientName: string
  orgName: string
  feedbackUrl: string
  bookingUrl: string
}, brand?: EmailBrand): string {
  const accent = accentOf(brand)
  const bodyHtml =
    h1('¿No pudiste asistir a tu cita?', T.text, 'center') +
    para(`Hola <strong>${p.patientName}</strong>, notamos que no pudiste asistir a tu cita en <strong>${p.orgName}</strong>. No te preocupes, queremos ayudarte.`, { margin: '0 0 24px' }) +
    `<div style="text-align:center;margin:0 0 28px;">${primaryButton('Cuéntanos qué pasó', p.feedbackUrl, accent)}</div>` +
    `<hr style="${DIVIDER}"/>` +
    para('¿Quieres reagendar tu cita?', { color: T.muted, size: 14, align: 'center', margin: '0 0 16px' }) +
    `<div style="text-align:center;">${outlineButton('Reagendar cita', p.bookingUrl, accent)}</div>`
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
  const headingText = isEs ? 'Tu cita ha sido reagendada' : 'Your appointment has been rescheduled'
  const body        = isEs
    ? `Hola <strong>${p.patientName}</strong>, tu cita en <strong>${p.orgName}</strong> ha sido reagendada para la siguiente fecha y hora.`
    : `Hi <strong>${p.patientName}</strong>, your appointment at <strong>${p.orgName}</strong> has been rescheduled to the following date and time.`
  const lType    = isEs ? 'Tipo de cita'  : 'Appointment type'
  const lNewDate = isEs ? 'Nueva fecha'   : 'New date'
  const lNewTime = isEs ? 'Nueva hora'    : 'New time'
  const typeRow  = p.appointmentTypeName ? `<tr ${ROW_BORDER}>${apptCell(lType, p.appointmentTypeName)}<td></td></tr>` : ''
  const bodyHtml =
    h1(headingText) +
    para(body, { margin: '0 0 24px' }) +
    detailTable(`${typeRow}<tr>${apptCell(lNewDate, p.newDate)}${apptCell(lNewTime, p.newTime)}</tr>`)
  return brandShell(lang, p.orgName, bodyHtml, brand)
}

// ── Clinic booking notification (interna) ─────────────────────────────────────

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
    return `<hr style="${DIVIDER}"/>` +
      `<p style="margin:0 0 12px;${FONT};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${T.subtle};">Información adicional</p>` +
      fields.map(([k, v]) => row(k, v)).join('')
  })()

  const bodyHtml =
    h1('Nueva cita agendada', T.text, 'center') +
    para(`Se registró una nueva cita en <strong>${p.orgName}</strong>.`, { color: T.muted, size: 14, align: 'center', margin: '0 0 24px' }) +
    row('Paciente', p.patientName) +
    row('Teléfono', p.patientPhone) +
    (p.patientEmail ? row('Email', p.patientEmail) : '') +
    (p.patientCedula ? row('Cédula', p.patientCedula) : '') +
    `<hr style="${DIVIDER}"/>` +
    row('Tipo de cita', typeDisplay) +
    row('Médico asignado', doctorDisplay) +
    row('Fecha', p.date) +
    row('Hora', p.time) +
    row('Modalidad', modalityDisplay) +
    customFieldsSection

  return brandShell('es', p.orgName, bodyHtml)
}

// ── Team invitation email (usuarios de la plataforma) ─────────────────────────

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
  const roleDisplay = ROLE_DISPLAY[p.role] ?? p.role

  const bodyHtml =
    h1('Te han invitado a unirte', T.text, 'center') +
    para(`Has sido invitado a unirte a <strong>${p.orgName}</strong> en MedScale AI como <strong>${roleDisplay}</strong>.`, { align: 'center', margin: '0 0 28px' }) +
    `<div style="text-align:center;margin:0 0 28px;">${primaryButton('Aceptar invitación', p.inviteLink, DEFAULT_PRIMARY)}</div>` +
    para('Si no esperabas esta invitación, puedes ignorar este correo.<br/>El enlace expirará en 24 horas.', { color: T.muted, size: 12, align: 'center', margin: '0' })

  return brandShell('es', p.orgName, bodyHtml)
}

// ── Internal clinic notification (legacy) ─────────────────────────────────────

export function bookingNotificationDoctor(p: BookingEmailParams): string {
  const doctorDisplay   = p.doctorName ?? 'Por asignar'
  const modalityDisplay = p.modality === 'virtual' ? 'Virtual' : 'Presencial'

  const bodyHtml =
    h1('Nueva cita agendada', T.text, 'center') +
    para(`Se ha registrado una nueva cita en <strong>${p.orgName}</strong>.`, { color: T.muted, size: 14, align: 'center', margin: '0 0 24px' }) +
    row('Paciente', p.patientName) +
    (p.appointmentTypeName ? row('Tipo de cita', p.appointmentTypeName) : '') +
    row('Médico', doctorDisplay) +
    row('Fecha', p.date) +
    row('Hora', p.time) +
    row('Modalidad', modalityDisplay) +
    `<hr style="${DIVIDER}"/>` +
    para('Revisa el panel de administración para más detalles.', { color: T.subtle, size: 13, margin: '0' })

  return brandShell('es', p.orgName, bodyHtml)
}

// ── Generic automation email (marketing) ──────────────────────────────────────

export function automationEmail(
  orgName: string,
  bodyText: string,
  ctaButton?: { label: string; url: string },
  brand?: EmailBrand,
  options?: { showUnsubscribe?: boolean },
): string {
  const paragraphs = bodyText
    .split('\n')
    .map(line =>
      line.trim()
        ? para(line, { margin: '0 0 14px' })
        : `<div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>`
    )
    .join('')

  const cta = ctaButton
    ? `<div style="text-align:center;margin:28px 0 8px;">${primaryButton(ctaButton.label, ctaButton.url, accentOf(brand))}</div>`
    : ''

  // Default false: transaccional-friendly. Las automatizaciones de marketing
  // (lib/automations/process.ts) pasan showUnsubscribe: true explícitamente.
  return brandShell('es', orgName, paragraphs + cta, brand, { showUnsubscribe: options?.showUnsubscribe ?? false })
}
