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

function currentYM(): string {
  return toBogotaYM(new Date().toISOString())
}

function prevYM(): string {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return toBogotaYM(prev.toISOString())
}

// Last 6 months ending with current month, as YYYY-MM strings
function getLast6Months(): string[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', timeZone: 'America/Bogota',
    }).format(d).slice(0, 7)
  })
}

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function monthLabel(ym: string): string {
  return MONTH_LABELS[Number(ym.slice(5)) - 1]
}

// Compute % delta; returns null when prev is 0 (avoids division by zero noise)
function delta(curr: number, prev: number): number | null {
  return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TodayAppointment {
  id: string
  scheduled_at: string
  status: string
  patientName: string | null
  doctorName: string | null
}

export interface DoctorStat {
  name: string
  total: number
  completed: number
}

export interface MonthPoint {
  label: string
  count: number
}

export interface FunnelCard {
  value: number
  delta: number | null
}

export interface DashboardData {
  // Funnel KPIs
  leadsThisMonth: FunnelCard
  inConversation: number
  citasThisMonth: FunnelCard
  attendedThisMonth: FunnelCard
  inProcedure: number
  // Today
  todayAppointments: TodayAppointment[]
  // Chart
  monthlyTrend: MonthPoint[]
  trendVsPrev: number | null
  monthlyAvg: number
  // Doctor table
  doctorStats: DoctorStat[]
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardData | null> {
  noStore() // opt out of Next.js data cache — always fetch at runtime
  console.log('DEBUG DATE CHECK:', {
    now: new Date().toISOString(),
    currentYM: currentYM(),
    last6months: getLast6Months(),
    nodeVersion: process.version,
  })
  try {
    const months      = getLast6Months()
    const fromDate    = months[0] + '-01'
    const thisYM      = currentYM()
    const lastYM      = prevYM()
    const today       = todayBogota()
    const thisMonthISO = thisYM + '-01T00:00:00.000Z'
    const prevMonthISO = lastYM + '-01T00:00:00.000Z'

    const [
      { data: apts },
      { data: leads },
      { data: doctors },
      { data: todayRaw },
    ] = await Promise.all([
      admin.from('appointments')
        .select('id, scheduled_at, status, doctor_id')
        .gte('scheduled_at', fromDate),
      admin.from('leads').select('id, status, created_at'),
      admin.from('doctors').select('id, metadata').eq('is_active', true),
      admin.from('appointments')
        .select('id, scheduled_at, status, lead:lead_id(contact_name), doctor:doctor_id(metadata)')
        .gte('scheduled_at', today + 'T00:00:00')
        .lte('scheduled_at', today + 'T23:59:59')
        .order('scheduled_at', { ascending: true }),
    ])

    const A = apts    ?? []
    const L = leads   ?? []
    const D = doctors ?? []

    // ── Funnel KPIs ───────────────────────────────────────────────────────────

    const leadsThisMonthVal  = L.filter(l => l.created_at >= thisMonthISO).length
    const leadsPrevMonthVal  = L.filter(l => l.created_at >= prevMonthISO && l.created_at < thisMonthISO).length

    const inConversation = L.filter(l => ['contactado', 'contacted'].includes(l.status)).length
    const inProcedure    = L.filter(l => ['en_procedimiento', 'in_procedure'].includes(l.status)).length

    const citasThisMonthVal = A.filter(a =>
      toBogotaYM(a.scheduled_at) === thisYM && a.status !== 'cancelled'
    ).length
    const citasPrevMonthVal = A.filter(a =>
      toBogotaYM(a.scheduled_at) === lastYM && a.status !== 'cancelled'
    ).length

    const attendedThisMonthVal = A.filter(a =>
      toBogotaYM(a.scheduled_at) === thisYM && a.status === 'completed'
    ).length
    const attendedPrevMonthVal = A.filter(a =>
      toBogotaYM(a.scheduled_at) === lastYM && a.status === 'completed'
    ).length

    // ── Today's appointments ──────────────────────────────────────────────────

    const todayAppointments: TodayAppointment[] = (todayRaw ?? []).map((a: any) => ({
      id:          a.id,
      scheduled_at: a.scheduled_at,
      status:      a.status,
      patientName: (Array.isArray(a.lead) ? a.lead[0]?.contact_name : a.lead?.contact_name) ?? null,
      doctorName:  (Array.isArray(a.doctor) ? a.doctor[0]?.metadata?.name : a.doctor?.metadata?.name) ?? null,
    }))

    // ── Chart: last 6 months ──────────────────────────────────────────────────

    const monthlyTrend: MonthPoint[] = months.map(ym => ({
      label: monthLabel(ym),
      count: A.filter(a => toBogotaYM(a.scheduled_at) === ym && a.status !== 'cancelled').length,
    }))

    const monthlyAvg = monthlyTrend.length
      ? Math.round(monthlyTrend.reduce((s, m) => s + m.count, 0) / monthlyTrend.length)
      : 0

    const currentCount = monthlyTrend[5]?.count ?? 0
    const prevCount    = monthlyTrend[4]?.count ?? 0
    const trendVsPrev  = delta(currentCount, prevCount)

    // ── Doctor stats ──────────────────────────────────────────────────────────

    const docMap = new Map<string, { name: string; total: number; completed: number }>()
    D.forEach(d => docMap.set(d.id, {
      name: String(d.metadata?.name ?? 'Médico'), total: 0, completed: 0,
    }))
    A.forEach(a => {
      const e = docMap.get(a.doctor_id)
      if (!e) return
      e.total++
      if (a.status === 'completed') e.completed++
    })
    const doctorStats: DoctorStat[] = Array.from(docMap.values())
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total)

    return {
      leadsThisMonth:    { value: leadsThisMonthVal,  delta: delta(leadsThisMonthVal, leadsPrevMonthVal) },
      inConversation,
      citasThisMonth:    { value: citasThisMonthVal,  delta: delta(citasThisMonthVal, citasPrevMonthVal) },
      attendedThisMonth: { value: attendedThisMonthVal, delta: delta(attendedThisMonthVal, attendedPrevMonthVal) },
      inProcedure,
      todayAppointments,
      monthlyTrend, trendVsPrev, monthlyAvg,
      doctorStats,
    }
  } catch (e) {
    console.error('getDashboardData error:', e)
    return null
  }
}
