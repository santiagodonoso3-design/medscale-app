import { resend } from '@/lib/email/resend'
import { automationEmail } from '@/lib/email/templates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

const MAX_EMAILS = 50
const APP_URL = 'https://app.medscale.app'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface AutomationRule {
  id: string
  organization_id: string
  rule_type: string
  delay_days: number | null
  trigger_date: string | null
  email_subject: string
  email_body: string
}

interface OrgData {
  id: string
  name: string
  slug: string | null
}

interface LeadRow {
  id: string
  contact_name?: string | null
  contact_last_name?: string | null
  contact_email: string
  metadata?: Record<string, unknown> | null
}

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

function parseBirthday(value: unknown): { month: number; day: number } | null {
  if (!value || typeof value !== 'string') return null
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return { month: parseInt(iso[2]), day: parseInt(iso[3]) }
  const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) return { month: parseInt(dmy[2]), day: parseInt(dmy[1]) }
  return null
}

// ── Core send + log ───────────────────────────────────────────────────────────

async function sendAndLog(
  admin: Admin,
  rule: AutomationRule,
  lead: { id: string; contact_email: string },
  subject: string,
  bodyText: string,
  orgName: string,
  ctaUrl?: string,
): Promise<boolean> {
  let status = 'sent'
  try {
    await resend.emails.send({
      from: 'citas@medscale.app',
      to:   lead.contact_email,
      subject,
      html: automationEmail(orgName, bodyText, ctaUrl ? { label: 'Reagendar cita', url: ctaUrl } : undefined),
    })
  } catch (err) {
    console.error(`[automations] Send failed rule=${rule.id} to=${lead.contact_email}:`, err)
    status = 'failed'
  }

  await admin.from('automation_logs').insert({
    organization_id:    rule.organization_id,
    automation_rule_id: rule.id,
    lead_id:            lead.id,
    email_sent_to:      lead.contact_email,
    status,
    sent_at:            new Date().toISOString(),
  })

  return status === 'sent'
}

// ── Rule processors ───────────────────────────────────────────────────────────

// followup_post_cita | noshow_recovery
async function processEventRule(
  admin: Admin, rule: AutomationRule, org: OrgData, today: string, remaining: number,
): Promise<number> {
  const delayDays  = rule.delay_days ?? 0
  const targetDate = addDays(today, -delayDays)
  const { start, end } = getDayRange(targetDate)
  const apptStatus = rule.rule_type === 'followup_post_cita' ? 'completed' : 'no_show'

  const { data: appointments } = await admin
    .from('appointments')
    .select('lead_id, leads(id, contact_name, contact_last_name, contact_email), doctors(metadata)')
    .eq('organization_id', rule.organization_id)
    .eq('status', apptStatus)
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .not('lead_id', 'is', null)
    .limit(remaining + 20) // fetch extra to account for already-logged ones

  if (!appointments?.length) return 0

  // Deduplicate by lead_id (in case same lead has multiple appts that day)
  const leadMap = new Map<string, { lead: LeadRow; doctorName: string }>()
  for (const appt of appointments) {
    const lead   = Array.isArray(appt.leads)   ? appt.leads[0]   : appt.leads
    const doctor = Array.isArray(appt.doctors) ? appt.doctors[0] : appt.doctors
    if (!lead?.id || !lead.contact_email || leadMap.has(lead.id)) continue
    leadMap.set(lead.id, { lead: lead as LeadRow, doctorName: doctorNameFromMeta(doctor) })
  }

  if (!leadMap.size) return 0

  const leadIds = [...leadMap.keys()]
  const { data: existingLogs } = await admin
    .from('automation_logs')
    .select('lead_id')
    .eq('automation_rule_id', rule.id)
    .in('lead_id', leadIds)

  const logged = new Set<string>(existingLogs?.map((l: { lead_id: string }) => l.lead_id) ?? [])

  let sent = 0
  for (const [leadId, { lead, doctorName }] of leadMap) {
    if (sent >= remaining) break
    if (logged.has(leadId)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: doctorName }
    const ctaUrl = rule.rule_type === 'noshow_recovery' && org.slug
      ? `${APP_URL}/book/${org.slug}`
      : undefined

    const ok = await sendAndLog(
      admin, rule,
      { id: lead.id, contact_email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      ctaUrl,
    )
    if (ok) sent++
  }

  return sent
}

// procedure_followup: lead en_tratamiento_medico, last completed appt was delay_days ago
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

  const { data: existingLogs } = await admin
    .from('automation_logs')
    .select('lead_id')
    .eq('automation_rule_id', rule.id)
    .in('lead_id', leads.map((l: { id: string }) => l.id))

  const logged = new Set<string>(existingLogs?.map((l: { lead_id: string }) => l.lead_id) ?? [])

  let sent = 0
  for (const lead of leads as LeadRow[]) {
    if (sent >= remaining) break
    if (logged.has(lead.id)) continue

    const vars = {
      nombre:         leadFullName(lead),
      nombre_clinica: org.name,
      nombre_doctor:  leadDoctorMap.get(lead.id) ?? 'Tu médico',
    }
    const ok = await sendAndLog(
      admin, rule,
      { id: lead.id, contact_email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
    )
    if (ok) sent++
  }

  return sent
}

// procedure_completed: lead finalizado, no log yet for this rule
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

  const { data: existingLogs } = await admin
    .from('automation_logs')
    .select('lead_id')
    .eq('automation_rule_id', rule.id)
    .in('lead_id', leads.map((l: { id: string }) => l.id))

  const logged = new Set<string>(existingLogs?.map((l: { lead_id: string }) => l.lead_id) ?? [])

  let sent = 0
  for (const lead of leads as LeadRow[]) {
    if (sent >= remaining) break
    if (logged.has(lead.id)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const ok = await sendAndLog(
      admin, rule,
      { id: lead.id, contact_email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
    )
    if (ok) sent++
  }

  return sent
}

// birthday: leads whose birth month+day == today in Bogotá, not yet sent this year
async function processBirthday(
  admin: Admin, rule: AutomationRule, org: OrgData, today: string, currentYear: string, remaining: number,
): Promise<number> {
  const [, todayMonthStr, todayDayStr] = today.split('-')
  const todayMonth = parseInt(todayMonthStr)
  const todayDay   = parseInt(todayDayStr)

  const { data: leads } = await admin
    .from('leads')
    .select('id, contact_name, contact_last_name, contact_email, metadata')
    .eq('organization_id', rule.organization_id)
    .not('contact_email', 'is', null)

  if (!leads?.length) return 0

  const birthdayLeads = (leads as LeadRow[]).filter(lead => {
    const meta = lead.metadata as Record<string, unknown> | null
    const dob  = meta?.fecha_de_nacimiento ?? meta?.['fecha-de-nacimiento'] ?? meta?.fecha_nacimiento
    const bd   = parseBirthday(dob)
    return bd && bd.month === todayMonth && bd.day === todayDay
  })

  if (!birthdayLeads.length) return 0

  // Dedup: one email per lead per calendar year
  const yearStart = `${currentYear}-01-01T00:00:00.000Z`
  const { data: existingLogs } = await admin
    .from('automation_logs')
    .select('lead_id')
    .eq('automation_rule_id', rule.id)
    .in('lead_id', birthdayLeads.map(l => l.id))
    .gte('sent_at', yearStart)

  const logged = new Set<string>(existingLogs?.map((l: { lead_id: string }) => l.lead_id) ?? [])

  let sent = 0
  for (const lead of birthdayLeads) {
    if (sent >= remaining) break
    if (logged.has(lead.id)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const ok = await sendAndLog(
      admin, rule,
      { id: lead.id, contact_email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
    )
    if (ok) sent++
  }

  return sent
}

// special_date: today == trigger_date → send to all leads, once per year
async function processSpecialDate(
  admin: Admin, rule: AutomationRule, org: OrgData, today: string, currentYear: string, remaining: number,
): Promise<number> {
  if (!rule.trigger_date || rule.trigger_date.slice(0, 10) !== today) return 0

  const { data: leads } = await admin
    .from('leads')
    .select('id, contact_name, contact_last_name, contact_email')
    .eq('organization_id', rule.organization_id)
    .not('contact_email', 'is', null)
    .limit(remaining + 50)

  if (!leads?.length) return 0

  // Dedup: one email per lead per calendar year (handles annual recurrence)
  const yearStart = `${currentYear}-01-01T00:00:00.000Z`
  const { data: existingLogs } = await admin
    .from('automation_logs')
    .select('lead_id')
    .eq('automation_rule_id', rule.id)
    .in('lead_id', leads.map((l: { id: string }) => l.id))
    .gte('sent_at', yearStart)

  const logged = new Set<string>(existingLogs?.map((l: { lead_id: string }) => l.lead_id) ?? [])

  let sent = 0
  for (const lead of leads as LeadRow[]) {
    if (sent >= remaining) break
    if (logged.has(lead.id)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const ok = await sendAndLog(
      admin, rule,
      { id: lead.id, contact_email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
    )
    if (ok) sent++
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
    .select('id, organization_id, rule_type, delay_days, trigger_date, email_subject, email_body')
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
    .select('id, name, slug')
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
          sent = await processSpecialDate(admin, rule, org, today, currentYear, remaining)
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
