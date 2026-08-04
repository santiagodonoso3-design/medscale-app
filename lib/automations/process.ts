import { resend } from '@/lib/email/resend'
import { automationEmail, type EmailBrand } from '@/lib/email/templates'

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

// ── Core send + log ───────────────────────────────────────────────────────────

async function sendAndLog(
  admin: Admin,
  rule: AutomationRule,
  lead: { id: string; contact_email: string },
  subject: string,
  bodyText: string,
  orgName: string,
  brand?: EmailBrand,
  cta?: { label: string; url: string },
): Promise<boolean> {
  let status = 'sent'
  try {
    await resend.emails.send({
      from: 'citas@medscale.app',
      to:   lead.contact_email,
      subject,
      html: automationEmail(orgName, bodyText, cta, brand),
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
      brandFromOrg(org),
      ctaUrl ? { label: 'Reagendar cita', url: ctaUrl } : undefined,
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
      brandFromOrg(org),
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
      brandFromOrg(org),
    )
    if (ok) sent++
  }

  return sent
}

// birthday: leads whose birth month+day == today, optionally filtered by status audience
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

  const yearStart = `${currentYear}-01-01T00:00:00.000Z`
  const { data: existingLogs } = await admin
    .from('automation_logs')
    .select('lead_id')
    .eq('automation_rule_id', rule.id)
    .in('lead_id', targetLeads.map((l: LeadRow) => l.id))
    .gte('sent_at', yearStart)

  const logged = new Set<string>(existingLogs?.map((l: { lead_id: string }) => l.lead_id) ?? [])

  let sent = 0
  for (const lead of targetLeads) {
    if (sent >= remaining) break
    if (logged.has(lead.id)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const ok = await sendAndLog(
      admin, rule,
      { id: lead.id, contact_email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
    )
    if (ok) sent++
  }

  return sent
}

// special_date: today == trigger_date → send to audience-filtered leads, once per year
async function processSpecialDate(
  admin: Admin, rule: AutomationRule, org: OrgData, today: string, currentYear: string, remaining: number,
): Promise<number> {
  if (!rule.trigger_date || rule.trigger_date.slice(0, 10) !== today) return 0

  const audience  = rule.audience ?? 'all'
  const yearStart = `${currentYear}-01-01T00:00:00.000Z`
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

  // Dedup: one email per lead per calendar year
  const { data: existingLogs } = await admin
    .from('automation_logs')
    .select('lead_id')
    .eq('automation_rule_id', rule.id)
    .in('lead_id', leads.map(l => l.id))
    .gte('sent_at', yearStart)

  const logged = new Set<string>(existingLogs?.map((l: { lead_id: string }) => l.lead_id) ?? [])

  let sent = 0
  for (const lead of leads) {
    if (sent >= remaining) break
    if (logged.has(lead.id)) continue

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const ok = await sendAndLog(
      admin, rule,
      { id: lead.id, contact_email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
    )
    if (ok) sent++
  }

  return sent
}

// lead_status: lead has spent delay_days in the rule.audience status and has not
// replied nor booked a new appointment since entering it. One email per lead, ever.
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

  const { data: existingLogs } = await admin
    .from('automation_logs')
    .select('lead_id')
    .eq('automation_rule_id', rule.id)
    .in('lead_id', leads.map((l: { id: string }) => l.id))

  const logged = new Set<string>(existingLogs?.map((l: { lead_id: string }) => l.lead_id) ?? [])

  const candidates = (leads as LeadRow[]).filter(l => !logged.has(l.id))
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

    const vars = { nombre: leadFullName(lead), nombre_clinica: org.name, nombre_doctor: 'Tu médico' }
    const ok = await sendAndLog(
      admin, rule,
      { id: lead.id, contact_email: lead.contact_email },
      replaceVars(rule.email_subject, vars),
      replaceVars(rule.email_body, vars),
      org.name,
      brandFromOrg(org),
      ctaUrl ? { label: 'Agendar cita', url: ctaUrl } : undefined,
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
          sent = await processSpecialDate(admin, rule, org, today, currentYear, remaining)
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
