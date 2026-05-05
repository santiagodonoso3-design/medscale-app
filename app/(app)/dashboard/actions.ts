'use server'

import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// ── Admin client (bypasses RLS) ───────────────────────────────────────────────

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Timezone helpers (Bogotá = UTC-5, no DST) ────────────────────────────────

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

function toBogotaYM(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Bogota',
  }).format(new Date(iso)).slice(0, 7)
}

function currentBogotaYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'America/Bogota' }).format(new Date())
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TodayAppointment {
  id: string
  scheduled_at: string
  status: string
  patientName: string | null
  doctorName: string | null
}

export interface RawAppointment {
  id: string
  scheduled_at: string
  status: string
  doctor_id: string
  ym: string  // YYYY-MM in Bogota tz, pre-computed server-side
}

export interface RawLead {
  id: string
  status: string
  created_at: string
  ym: string  // YYYY-MM in Bogota tz, pre-computed server-side
}

export interface RawDoctor {
  id: string
  name: string
}

export interface RawDashboardData {
  year: number
  appointments: RawAppointment[]
  yearLeads: RawLead[]
  inConversationCount: number  // current state — no date filter
  inProcedureCount: number     // current state — no date filter
  doctors: RawDoctor[]
  todayAppointments: TodayAppointment[]
}

// ── Fetch all data for a given year ──────────────────────────────────────────

export async function getDashboardRawData(year: number): Promise<RawDashboardData | null> {
  noStore()
  try {
    const today    = todayBogota()
    const fromDate = `${year}-01-01`
    const toDate   = `${year + 1}-01-01`

    const [
      { data: apts },
      { data: yearLeadsRaw },
      { data: stateLeads },
      { data: doctorsRaw },
      { data: todayRaw },
    ] = await Promise.all([
      admin.from('appointments')
        .select('id, scheduled_at, status, doctor_id')
        .gte('scheduled_at', fromDate)
        .lt('scheduled_at', toDate),
      admin.from('leads')
        .select('id, status, created_at')
        .gte('created_at', fromDate)
        .lt('created_at', toDate),
      admin.from('leads')
        .select('id, status')
        .in('status', ['contactado', 'en_tratamiento_medico']),
      admin.from('doctors')
        .select('id, metadata')
        .eq('is_active', true),
      admin.from('appointments')
        .select('id, scheduled_at, status, lead:lead_id(contact_name), doctor:doctor_id(metadata)')
        .gte('scheduled_at', today + 'T00:00:00')
        .lte('scheduled_at', today + 'T23:59:59')
        .order('scheduled_at', { ascending: true }),
    ])

    const appointments: RawAppointment[] = (apts ?? []).map((a: any) => ({
      id: a.id, scheduled_at: a.scheduled_at, status: a.status, doctor_id: a.doctor_id,
      ym: toBogotaYM(a.scheduled_at),
    }))

    const yearLeads: RawLead[] = (yearLeadsRaw ?? []).map((l: any) => ({
      id: l.id, status: l.status, created_at: l.created_at,
      ym: toBogotaYM(l.created_at),
    }))

    const sl = stateLeads ?? []
    const inConversationCount = sl.filter((l: any) => l.status === 'contactado').length
    const inProcedureCount    = sl.filter((l: any) => l.status === 'en_tratamiento_medico').length

    const doctors: RawDoctor[] = (doctorsRaw ?? []).map((d: any) => ({
      id: d.id, name: String(d.metadata?.name ?? 'Médico'),
    }))

    const todayAppointments: TodayAppointment[] = (todayRaw ?? []).map((a: any) => ({
      id: a.id, scheduled_at: a.scheduled_at, status: a.status,
      patientName: (Array.isArray(a.lead) ? a.lead[0]?.contact_name : a.lead?.contact_name) ?? null,
      doctorName:  (Array.isArray(a.doctor) ? a.doctor[0]?.metadata?.name : a.doctor?.metadata?.name) ?? null,
    }))

    return { year, appointments, yearLeads, inConversationCount, inProcedureCount, doctors, todayAppointments }
  } catch (e) {
    console.error('getDashboardRawData error:', e)
    return null
  }
}

// ── Years that have appointment or lead data ──────────────────────────────────

export async function getDashboardYears(): Promise<number[]> {
  try {
    const curYear = currentBogotaYear()
    const [{ data: firstApt }, { data: firstLead }] = await Promise.all([
      admin.from('appointments').select('scheduled_at').order('scheduled_at', { ascending: true }).limit(1),
      admin.from('leads').select('created_at').order('created_at', { ascending: true }).limit(1),
    ])
    let minYear = curYear
    if (firstApt?.[0]?.scheduled_at) minYear = Math.min(minYear, Number(firstApt[0].scheduled_at.slice(0, 4)))
    if (firstLead?.[0]?.created_at)  minYear = Math.min(minYear, Number(firstLead[0].created_at.slice(0, 4)))
    const years: number[] = []
    for (let y = minYear; y <= curYear; y++) years.push(y)
    return years
  } catch {
    return [new Date().getFullYear()]
  }
}
