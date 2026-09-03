import { resend } from '@/lib/email/resend'
import { automationEmail, type EmailBrand } from '@/lib/email/templates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

const MAX_EMAILS = 50
const APP_URL = 'https://app.medscale.app'
// Postgres SQLSTATE unique_violation — raised by automation_logs_dedup_unique
const UNIQUE_VIOLATION = '23505'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface AutomationRule {
  id: string
  organization_id: string
  rule_type: string
  delay_days: number | null
  trigger_date: string | null
  email_subject: string
  email_body: string
  audience: string | null
}

interface OrgData {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  primary_color: string | null
}

interface LeadRow {
  id: string
  contact_name?: string | null
  contact_last_name?: string | null
  contact_email: string
  metadata?: Record<string, unknown> | null
}

// Identity of ONE occurrence of a rule for ONE subject. Together with
// automation_rule_id it forms the UNIQUE tuple of automation_logs
// (automation_logs_dedup_unique) that makes every send idempotent.
//
// occurrence_key is deterministic per rule_type (never Date.now() / random):
//   followup_post_cita  → appt_<appointment.id>             subject = appointment
//   noshow_recovery     → appt_<appointment.id>             subject = appointment
//   procedure_followup  → lead_<lead.id>                    subject = lead
//   procedure_completed → lead_<lead.id>                    subject = lead
//   birthday            → lead_<lead.id>_year_<currentYear> subject = lead
//   special_date        → lead_<lead.id>_date_<trigger_date> subject = lead
//   lead_status         → lead_<lead.id>_to_<audience>      subject = lead
type SubjectType = 'lead' | 'appointment'

interface LogSubject {
  subject_type: SubjectType
  subject_id: string
  occurrence_key: string
}

type SendOutcome = 'sent' | 'failed' | 'skipped'

// ── Date helpers ──────────────────────────────────────────────────────────────

function getTodayBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Bogotá = UTC-5: midnight Bogotá is 05:00 UTC
function getDayRange(dateStr: string) {
  return {
    start: `${dateStr}T05:00:00.000Z`,
    end:   `${addDays(dateStr, 1)}T05:00:00.000Z`,
  }
}

// ── Variable replacement ──────────────────────────────────────────────────────

function replaceVars(
  text: string,
  vars: { nombre: string; nombre_clinica: string; nombre_doctor: string },
): string {
  return text
    .replace(/\{\{nombre\}\}/g, vars.nombre)
    .replace(/\{\{nombre_clinica\}\}/g, vars.nombre_clinica)
    .replace(/\{\{nombre_doctor\}\}/g, vars.nombre_doctor)
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function leadFullName(lead: { contact_name?: string | null; contact_last_name?: string | null }): string {
  return [lead.contact_name, lead.contact_last_name].filter(Boolean).join(' ') || 'Paciente'
}

function doctorNameFromMeta(doctor: { metadata?: Record<string, unknown> | null } | null): string {
  return String(doctor?.metadata?.name ?? 'Tu médico')
}

function brandFromOrg(org: OrgData): EmailBrand {
  return { logoUrl: org.logo_url, primaryColor: org.primary_color }
}

function parseBirthday(value: unknown): { month: number; day: number } | null {
  if (!value || typeof value !== 'string') return null
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return { month: parseInt(iso[2]), day: parseInt(iso[3]) }
  const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) return { month: parseInt(dmy[2]), day: parseInt(dmy[1]) }
  return null
}

// ── Idempotent log + send ─────────────────────────────────────────────────────

// Pre-filter (efficiency only): occurrence keys already logged for this rule.
// The UNIQUE constraint is the real guardrail; this just avoids one failed
// INSERT per already-handled candidate on every daily run.
async function fetchLoggedKeys(admin: Admin, ruleId: string, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set()
  const { data } = await admin
    .from('automation_logs')
    .select('occurrence_key')
    .eq('automation_rule_id', ruleId)
    .in('occurrence_key', keys)
  return new Set<string>(data?.map((l: { occurrence_key: string }) => l.occurrence_key) ?? [])
}

// 1. INSERT the log row (reserves the occurrence) → 2. send → 3. on send failure
// mark the row as failed. If the INSERT hits the unique constraint the occurrence
// was already handled (previous or concurrent run): skip WITHOUT calling Resend.
// The email is only ever sent after a successful INSERT.
async function sendAndLog(
  admin: Admin,
  rule: AutomationRule,
  subject: LogSubject,
  recipient: { leadId: string | null; email: string },
  emailSubject: string,
  bodyText: string,
  orgName: string,
  brand?: EmailBrand,
  cta?: { label: string; url: string },
): Promise<SendOutcome> {
  const { error: insertErr } = await admin
    .from('automation_logs')
    .insert({
      organization_id:    rule.organization_id,
      automation_rule_id: rule.id,
      subject_type:       subject.subject_type,
      subject_id:         subject.subject_id,
      occurrence_key:     subject.occurrence_key,
      lead_id:            recipient.leadId, // compat: nullable when the subject is not a lead
      email_sent_to:      recipient.email,
      status:             'sent',
      sent_at:            new Date().toISOString(),
    })

  if (insertErr) {
    if (insertErr.code === UNIQUE_VIOLATION) {
      console.log(
        `[automations] dedup skip rule=${rule.id} subject=${subject.subject_type}:${subject.subject_id} key=${subject.occurrence_key}`,
      )
      return 'skipped'
    }
    console.error(`[automations] insert log failed rule=${rule.id}:`, insertErr)
    return 'skipped'
  }

  // Only reached when the INSERT succeeded: this run owns the occurrence.
  let errorMessage: string | null = null
  try {
    const { error: sendErr } = await resend.emails.send({
      from:    'citas@medscale.app',
      to:      recipient.email,
      subject: emailSubject,
      html:    automationEmail(orgName, bodyText, cta, brand),
    })
    if (sendErr) errorMessage = sendErr.message
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  if (errorMessage === null) return 'sent'

  console.error(`[automations] Send failed rule=${rule.id} to=${recipient.email}: ${errorMessage}`)
  await admin
    .from('automation_logs')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('automation_rule_id', rule.id)
    .eq('subject_type', subject.subject_type)
    .eq('subject_id', subject.subject_id)
    .eq('occurrence_key', subject.occurrence_key)

  return 'failed'
}

// ── Rule processors ───────────────────────────────────────────────────────────

// followup_post_cita | noshow_recovery — one occurrence per appointment
async function processEventRule(
  admin: Admin, rule: AutomationRule, org: OrgData, today: string, remaining: number,
): Promise<number> {
  const delayDays  = rule.delay_days ?? 0
  const targetDate = addDays(today, -delayDays)
  const { start, end } = getDayRange(targetDate)
  const apptStatus = rule.rule_type === 'followup_post_cita' ? 'completed' : 'no_show'

  const { data: appointments } = await admin
    .from('appointments')
    .select('id, lead_id, leads(id, contact_name, contact_last_name, contact_email), doctors(metadata)')
    .eq('organization_id', rule.organization_id)
    .eq('status', apptStatus)
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .not('lead_id', 'is', null)
    .limit(remaining + 20) // fetch extra to account for already-logged ones

  if (!appointments?.length) return 0

  // One email per lead per day even if it had several appointments that day:
  // the first appointment seen is the occurrence that gets logged.
  const leadMap = new Map<string, { apptId: string; lead: LeadRow; doctorName: string }>()
  for (const appt of appointments) {
    const lead   = Array.isArray(appt.leads)   ? appt.leads[0]   : appt.leads
    const doctor = Array.isArray(appt.doctors) ? appt.doctors[0] : appt.doctors
    if (!appt.id || !lead?.id || !lead.contact_email || leadMap.has(lead.id)) continue
    leadMap.set(lead.id, { apptId: appt.id, lead: lead as LeadRow, doctorName: doctorNameFromMeta(doctor) })
  }

  if (!leadMap.size) return 0

  const logged = await fetchLoggedKeys(
    admin, rule.id, [...leadMap.values()].map(v => `appt_${v.apptId}`),
  )

  let sent = 0
  for (const { apptId, lead, doctorName } of leadMap.values()) {
    if (sent >= remaining) break

    const subject: LogSubject = {
      subject_type:   'appointment',
      subject_id:     apptId,
      occurrence_key: `appt_${apptId}`,
    }
    if (logged.has(subject.occurrence_key)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: doctorName }
    const ctaUrl = rule.rule_type === 'noshow_recovery' && org.slug
      ? `${APP_URL}/book/${org.slug}`
      : undefined

    const outcome = await sendAndLog(
      admin, rule, subject,
      { leadId: lead.id, email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
      ctaUrl ? { label: 'Reagendar cita', url: ctaUrl } : undefined,
    )
    if (outcome === 'sent') sent++
  }

  return sent
}

// procedure_followup: lead en_tratamiento_medico, last completed appt was delay_days ago.
// One occurrence per lead.
async function processProcedureFollowup(
  admin: Admin, rule: AutomationRule, org: OrgData, today: string, remaining: number,
): Promise<number> {
  const delayDays  = rule.delay_days ?? 7
  const targetDate = addDays(today, -delayDays)
  const { start, end } = getDayRange(targetDate)

  const { data: appointments } = await admin
    .from('appointments')
    .select('lead_id, doctors(metadata)')
    .eq('organization_id', rule.organization_id)
    .eq('status', 'completed')
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .not('lead_id', 'is', null)

  if (!appointments?.length) return 0

  // lead_id → doctorName (first match wins)
  const leadDoctorMap = new Map<string, string>()
  for (const appt of appointments) {
    if (!appt.lead_id || leadDoctorMap.has(appt.lead_id)) continue
    const doctor = Array.isArray(appt.doctors) ? appt.doctors[0] : appt.doctors
    leadDoctorMap.set(appt.lead_id, doctorNameFromMeta(doctor))
  }

  if (!leadDoctorMap.size) return 0

  // Get those leads with status en_tratamiento_medico and an email
  const { data: leads } = await admin
    .from('leads')
    .select('id, contact_name, contact_last_name, contact_email')
    .eq('organization_id', rule.organization_id)
    .eq('status', 'en_tratamiento_medico')
    .in('id', [...leadDoctorMap.keys()])
    .not('contact_email', 'is', null)

  if (!leads?.length) return 0

  const logged = await fetchLoggedKeys(
    admin, rule.id, leads.map((l: { id: string }) => `lead_${l.id}`),
  )

  let sent = 0
  for (const lead of leads as LeadRow[]) {
    if (sent >= remaining) break

    const subject: LogSubject = {
      subject_type:   'lead',
      subject_id:     lead.id,
      occurrence_key: `lead_${lead.id}`,
    }
    if (logged.has(subject.occurrence_key)) continue

    const vars = {
      nombre:         leadFullName(lead),
      nombre_clinica: org.name,
      nombre_doctor:  leadDoctorMap.get(lead.id) ?? 'Tu médico',
    }
    const outcome = await sendAndLog(
      admin, rule, subject,
      { leadId: lead.id, email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
    )
    if (outcome === 'sent') sent++
  }

  return sent
}

// procedure_completed: lead finalizado. One occurrence per lead.
async function processProcedureCompleted(
  admin: Admin, rule: AutomationRule, org: OrgData, remaining: number,
): Promise<number> {
  const { data: leads } = await admin
    .from('leads')
    .select('id, contact_name, contact_last_name, contact_email')
    .eq('organization_id', rule.organization_id)
    .eq('status', 'finalizado')
    .not('contact_email', 'is', null)
    .limit(remaining + 50)

  if (!leads?.length) return 0

  const logged = await fetchLoggedKeys(
    admin, rule.id, leads.map((l: { id: string }) => `lead_${l.id}`),
  )

  let sent = 0
  for (const lead of leads as LeadRow[]) {
    if (sent >= remaining) break

    const subject: LogSubject = {
      subject_type:   'lead',
      subject_id:     lead.id,
      occurrence_key: `lead_${lead.id}`,
    }
    if (logged.has(subject.occurrence_key)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const outcome = await sendAndLog(
      admin, rule, subject,
      { leadId: lead.id, email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
    )
    if (outcome === 'sent') sent++
  }

  return sent
}

// birthday: leads whose birth month+day == today, optionally filtered by status audience.
// One occurrence per lead per calendar year (the year is part of the key).
async function processBirthday(
  admin: Admin, rule: AutomationRule, org: OrgData, today: string, currentYear: string, remaining: number,
): Promise<number> {
  const [, todayMonthStr, todayDayStr] = today.split('-')
  const todayMonth = parseInt(todayMonthStr)
  const todayDay   = parseInt(todayDayStr)
  const audience   = rule.audience ?? 'birthday'

  const { data: allLeads } = await admin
    .from('leads')
    .select('id, contact_name, contact_last_name, contact_email, metadata, status')
    .eq('organization_id', rule.organization_id)
    .not('contact_email', 'is', null)

  if (!allLeads?.length) return 0

  // Filter: leads with birthday today
  const birthdayLeads = (allLeads as (LeadRow & { status?: string })[]).filter(lead => {
    const meta = lead.metadata as Record<string, unknown> | null
    const dob  = meta?.fecha_de_nacimiento ?? meta?.['fecha-de-nacimiento'] ?? meta?.fecha_nacimiento
    const bd   = parseBirthday(dob)
    return bd && bd.month === todayMonth && bd.day === todayDay
  })

  if (!birthdayLeads.length) return 0

  // audience = 'all' | 'birthday' → no extra status filter
  // audience = anything else → also filter by lead.status
  const targetLeads = (audience === 'all' || audience === 'birthday')
    ? birthdayLeads
    : birthdayLeads.filter(l => l.status === audience)

  if (!targetLeads.length) return 0

  const logged = await fetchLoggedKeys(
    admin, rule.id, targetLeads.map(l => `lead_${l.id}_year_${currentYear}`),
  )

  let sent = 0
  for (const lead of targetLeads) {
    if (sent >= remaining) break

    const subject: LogSubject = {
      subject_type:   'lead',
      subject_id:     lead.id,
      occurrence_key: `lead_${lead.id}_year_${currentYear}`,
    }
    if (logged.has(subject.occurrence_key)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const outcome = await sendAndLog(
      admin, rule, subject,
      { leadId: lead.id, email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
    )
    if (outcome === 'sent') sent++
  }

  return sent
}

// special_date: today == trigger_date → send to audience-filtered leads.
// One occurrence per lead per trigger_date (re-dating the rule next year re-sends).
async function processSpecialDate(
  admin: Admin, rule: AutomationRule, org: OrgData, today: string, remaining: number,
): Promise<number> {
  if (!rule.trigger_date || rule.trigger_date.slice(0, 10) !== today) return 0

  const audience = rule.audience ?? 'all'
  let leads: LeadRow[] = []

  if (audience === 'birthday') {
    // Leads with birthday today
    const [, mm, dd] = today.split('-')
    const todayMonth = parseInt(mm)
    const todayDay   = parseInt(dd)

    const { data: allLeads } = await admin
      .from('leads')
      .select('id, contact_name, contact_last_name, contact_email, metadata')
      .eq('organization_id', rule.organization_id)
      .not('contact_email', 'is', null)

    leads = ((allLeads ?? []) as LeadRow[]).filter(lead => {
      const meta = lead.metadata as Record<string, unknown> | null
      const dob  = meta?.fecha_de_nacimiento ?? meta?.['fecha-de-nacimiento'] ?? meta?.fecha_nacimiento
      const bd   = parseBirthday(dob)
      return bd && bd.month === todayMonth && bd.day === todayDay
    })
  } else if (audience === 'noshow') {
    // Leads with at least one no_show appointment
    const { data: appts } = await admin
      .from('appointments')
      .select('lead_id')
      .eq('organization_id', rule.organization_id)
      .eq('status', 'no_show')
      .not('lead_id', 'is', null)

    const leadIds = [...new Set<string>(
      ((appts ?? []) as { lead_id: string }[]).map(a => a.lead_id)
    )]
    if (!leadIds.length) return 0

    const { data: rawLeads } = await admin
      .from('leads')
      .select('id, contact_name, contact_last_name, contact_email')
      .eq('organization_id', rule.organization_id)
      .in('id', leadIds)
      .not('contact_email', 'is', null)
      .limit(remaining + 50)

    leads = (rawLeads ?? []) as LeadRow[]
  } else if (audience !== 'all') {
    // Filter by lead.status = audience
    const { data: rawLeads } = await admin
      .from('leads')
      .select('id, contact_name, contact_last_name, contact_email')
      .eq('organization_id', rule.organization_id)
      .eq('status', audience)
      .not('contact_email', 'is', null)
      .limit(remaining + 50)

    leads = (rawLeads ?? []) as LeadRow[]
  } else {
    // 'all': all leads with email
    const { data: rawLeads } = await admin
      .from('leads')
      .select('id, contact_name, contact_last_name, contact_email')
      .eq('organization_id', rule.organization_id)
      .not('contact_email', 'is', null)
      .limit(remaining + 50)

    leads = (rawLeads ?? []) as LeadRow[]
  }

  if (!leads.length) return 0

  const logged = await fetchLoggedKeys(admin, rule.id, leads.map(l => `lead_${l.id}_date_${rule.trigger_date}`))

  let sent = 0
  for (const lead of leads) {
    if (sent >= remaining) break

    const subject: LogSubject = {
      subject_type:   'lead',
      subject_id:     lead.id,
      occurrence_key: `lead_${lead.id}_date_${rule.trigger_date}`,
    }
    if (logged.has(subject.occurrence_key)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const outcome = await sendAndLog(
      admin, rule, subject,
      { leadId: lead.id, email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
    )
    if (outcome === 'sent') sent++
  }

  return sent
}

// lead_status: lead has spent delay_days in the rule.audience status and has not
// replied nor booked a new appointment since entering it.
// One occurrence per lead per target status.
async function processLeadStatusRule(
  admin: Admin, rule: AutomationRule, org: OrgData, remaining: number,
): Promise<number> {
  const targetStatus = rule.audience
  if (!targetStatus || targetStatus === 'all' || targetStatus === 'birthday') return 0

  const delayDays = rule.delay_days ?? 0
  // Entered the status on (today - delayDays) or earlier → has spent ≥ delayDays in it
  const cutoff = getDayRange(addDays(getTodayBogota(), -delayDays)).end

  const { data: transitions } = await admin
    .from('lead_status_history')
    .select('lead_id, changed_at')
    .eq('organization_id', rule.organization_id)
    .eq('to_status', targetStatus)
    .lte('changed_at', cutoff)
    .order('changed_at', { ascending: false })
    .limit(remaining + 100)

  if (!transitions?.length) return 0

  // Most recent qualifying transition per lead (rows come newest-first)
  const changedAtMap = new Map<string, string>()
  for (const t of transitions as { lead_id: string; changed_at: string }[]) {
    if (!changedAtMap.has(t.lead_id)) changedAtMap.set(t.lead_id, t.changed_at)
  }

  const { data: leads } = await admin
    .from('leads')
    .select('id, contact_name, contact_last_name, contact_email, status')
    .eq('organization_id', rule.organization_id)
    .eq('status', targetStatus) // must STILL be in the target status
    .in('id', [...changedAtMap.keys()])
    .not('contact_email', 'is', null)

  if (!leads?.length) return 0

  const logged = await fetchLoggedKeys(
    admin, rule.id, leads.map((l: { id: string }) => `lead_${l.id}_to_${targetStatus}`),
  )

  const candidates = (leads as LeadRow[]).filter(l => !logged.has(`lead_${l.id}_to_${targetStatus}`))
  if (!candidates.length) return 0

  // Revalidation in batch: discard leads that replied (inbound message) or booked
  // an appointment after entering the status
  const candidateIds = candidates.map(l => l.id)
  let minMs = Infinity
  for (const id of candidateIds) {
    const t = changedAtMap.get(id)
    if (!t) continue
    const ms = new Date(t).getTime()
    if (!Number.isNaN(ms) && ms < minMs) minMs = ms
  }
  const minChangedAt = Number.isFinite(minMs)
    ? new Date(minMs).toISOString()
    : new Date(0).toISOString()

  const [{ data: inboundMsgs }, { data: newAppts }] = await Promise.all([
    admin
      .from('messages')
      .select('lead_id, created_at')
      .eq('organization_id', rule.organization_id)
      .eq('direction', 'inbound')
      .in('lead_id', candidateIds)
      .gt('created_at', minChangedAt),
    admin
      .from('appointments')
      .select('lead_id, created_at')
      .eq('organization_id', rule.organization_id)
      .in('lead_id', candidateIds)
      .gt('created_at', minChangedAt),
  ])

  const replied = new Set<string>()
  for (const m of (inboundMsgs ?? []) as { lead_id: string; created_at: string }[]) {
    const changedAt = changedAtMap.get(m.lead_id)
    if (!changedAt) continue
    const changedMs = new Date(changedAt).getTime()
    const eventMs   = new Date(m.created_at).getTime()
    // Unparseable timestamps → fail toward NOT sending
    if (Number.isNaN(changedMs) || Number.isNaN(eventMs) || eventMs > changedMs) {
      replied.add(m.lead_id)
    }
  }
  const booked = new Set<string>()
  for (const a of (newAppts ?? []) as { lead_id: string; created_at: string }[]) {
    const changedAt = changedAtMap.get(a.lead_id)
    if (!changedAt) continue
    const changedMs = new Date(changedAt).getTime()
    const eventMs   = new Date(a.created_at).getTime()
    // Unparseable timestamps → fail toward NOT sending
    if (Number.isNaN(changedMs) || Number.isNaN(eventMs) || eventMs > changedMs) {
      booked.add(a.lead_id)
    }
  }

  const discardedReplied = candidates.filter(l => replied.has(l.id)).length
  const discardedBooked  = candidates.filter(l => !replied.has(l.id) && booked.has(l.id)).length
  if (discardedReplied || discardedBooked) {
    console.log(
      `[automations] rule=${rule.id} lead_status: discarded ${discardedReplied} (inbound reply), ${discardedBooked} (new appointment)`,
    )
  }

  const ctaUrl = org.slug ? `${APP_URL}/book/${org.slug}` : undefined

  let sent = 0
  for (const lead of candidates) {
    if (sent >= remaining) break
    if (replied.has(lead.id) || booked.has(lead.id)) continue

    const subject: LogSubject = {
      subject_type:   'lead',
      subject_id:     lead.id,
      occurrence_key: `lead_${lead.id}_to_${targetStatus}`,
    }

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const outcome = await sendAndLog(
      admin, rule, subject,
      { leadId: lead.id, email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
      ctaUrl ? { label: 'Agendar cita', url: ctaUrl } : undefined,
    )
    if (outcome === 'sent') sent++
  }

  return sent
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function processAutomationRules(admin: Admin): Promise<number> {
  const today       = getTodayBogota()
  const currentYear = today.slice(0, 4)
  let totalSent     = 0

  const { data: rules, error: rulesError } = await admin
    .from('automation_rules')
    .select('id, organization_id, rule_type, delay_days, trigger_date, email_subject, email_body, audience')
    .eq('is_active', true)

  if (rulesError) {
    console.error('[automations] Error fetching rules:', rulesError)
    return 0
  }
  if (!rules?.length) return 0

  // Fetch all relevant orgs in one query
  const orgIds = [...new Set<string>(rules.map((r: { organization_id: string }) => r.organization_id))]
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name, slug, logo_url, primary_color')
    .in('id', orgIds)

  const orgMap = new Map<string, OrgData>(
    orgs?.map((o: OrgData) => [o.id, o]) ?? [],
  )

  for (const rule of rules as AutomationRule[]) {
    if (totalSent >= MAX_EMAILS) break

    const org = orgMap.get(rule.organization_id)
    if (!org) continue
    if (!rule.email_subject || !rule.email_body) continue

    const remaining = MAX_EMAILS - totalSent

    try {
      let sent = 0
      switch (rule.rule_type) {
        case 'followup_post_cita':
        case 'noshow_recovery':
          sent = await processEventRule(admin, rule, org, today, remaining)
          break
        case 'procedure_followup':
          sent = await processProcedureFollowup(admin, rule, org, today, remaining)
          break
        case 'procedure_completed':
          sent = await processProcedureCompleted(admin, rule, org, remaining)
          break
        case 'birthday':
          sent = await processBirthday(admin, rule, org, today, currentYear, remaining)
          break
        case 'special_date':
          sent = await processSpecialDate(admin, rule, org, today, remaining)
          break
        case 'lead_status':
          sent = await processLeadStatusRule(admin, rule, org, remaining)
          break
      }
      if (sent > 0) {
        console.log(`[automations] rule=${rule.id} type=${rule.rule_type} sent=${sent}`)
      }
      totalSent += sent
    } catch (err) {
      console.error(`[automations] Error on rule ${rule.id} (${rule.rule_type}):`, err)
    }
  }

  return totalSent
}
