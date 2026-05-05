'use server'

import { createClient } from '@/lib/supabase/server'

// ── Timezone helpers ──────────────────────────────────────────────────────────

function toBogotaYM(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Bogota',
  }).format(new Date(iso)).slice(0, 7)
}

function currentYM(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Bogota',
  }).format(new Date()).slice(0, 7)
}

function getLast7Months(): string[] {
  const now = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1)
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', timeZone: 'America/Bogota',
    }).format(d).slice(0, 7)
  })
}

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function monthLabel(ym: string): string {
  return MONTH_LABELS[Number(ym.slice(5)) - 1]
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DoctorStat {
  name: string
  total: number
  completed: number
  no_show: number
  cancelled: number
  attendanceRate: number
}

export interface MonthPoint {
  label: string
  count: number
}

export interface DashboardData {
  appointmentsThisMonth: number
  attendanceRate: number
  activeInProcedure: number
  newLeadsThisMonth: number
  monthlyTrend: MonthPoint[]
  trendVsPrev: number
  monthlyAvg: number
  totalInProcedure: number
  avgProcedurePerMonth: number
  leadToProcedureRate: number
  doctorStats: DoctorStat[]
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient()
  try {
    const months   = getLast7Months()
    const fromDate = months[0] + '-01'
    const thisYM   = currentYM()

    const thisMonthStart = new Date(thisYM + '-01T00:00:00.000Z').toISOString()

    const [{ data: apts }, { data: leads }, { data: doctors }] = await Promise.all([
      supabase.from('appointments')
        .select('id, scheduled_at, status, doctor_id')
        .gte('scheduled_at', fromDate),
      supabase.from('leads').select('id, status, created_at'),
      supabase.from('doctors').select('id, metadata').eq('is_active', true),
    ])

    const A = apts    ?? []
    const L = leads   ?? []
    const D = doctors ?? []

    // ── Block 1 KPIs ──────────────────────────────────────────────────────────
    const thisMonthApts  = A.filter(a => toBogotaYM(a.scheduled_at) === thisYM)
    const appointmentsThisMonth = thisMonthApts.length

    const totalNonCancelled = A.filter(a => a.status !== 'cancelled').length
    const totalCompleted    = A.filter(a => a.status === 'completed').length
    const attendanceRate    = totalNonCancelled > 0
      ? Math.round((totalCompleted / totalNonCancelled) * 100) : 0

    const activeInProcedure  = L.filter(l => l.status === 'en_procedimiento').length
    const newLeadsThisMonth  = L.filter(l => l.created_at >= thisMonthStart).length

    // ── Block 2 Trend ─────────────────────────────────────────────────────────
    const monthlyTrend: MonthPoint[] = months.map(ym => ({
      label: monthLabel(ym),
      count: A.filter(a => toBogotaYM(a.scheduled_at) === ym && a.status !== 'cancelled').length,
    }))

    // avg from first 6 months (exclude current partial month)
    const pastCounts  = monthlyTrend.slice(0, 6).map(m => m.count)
    const monthlyAvg  = pastCounts.length
      ? Math.round(pastCounts.reduce((s, c) => s + c, 0) / pastCounts.length) : 0

    const currentCount = monthlyTrend[6]?.count ?? 0
    const prevCount    = monthlyTrend[5]?.count ?? 0
    const trendVsPrev  = prevCount > 0
      ? Math.round(((currentCount - prevCount) / prevCount) * 100) : 0

    // ── Block 3 Procedures ────────────────────────────────────────────────────
    const totalInProcedure      = activeInProcedure
    const avgProcedurePerMonth  = monthlyAvg  // use overall avg as proxy
    const leadToProcedureRate   = L.length > 0
      ? Math.round((activeInProcedure / L.length) * 100) : 0

    // ── Block 4 By doctor ─────────────────────────────────────────────────────
    const docMap = new Map<string, { name: string; total: number; completed: number; no_show: number; cancelled: number }>()
    D.forEach(d => docMap.set(d.id, {
      name: String(d.metadata?.name ?? 'Médico'),
      total: 0, completed: 0, no_show: 0, cancelled: 0,
    }))
    A.forEach(a => {
      const e = docMap.get(a.doctor_id)
      if (!e) return
      e.total++
      if (a.status === 'completed') e.completed++
      else if (a.status === 'no_show') e.no_show++
      else if (a.status === 'cancelled') e.cancelled++
    })
    const doctorStats: DoctorStat[] = Array.from(docMap.values())
      .filter(d => d.total > 0)
      .map(d => ({
        ...d,
        attendanceRate: (d.total - d.cancelled) > 0
          ? Math.round((d.completed / (d.total - d.cancelled)) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)

    return {
      appointmentsThisMonth, attendanceRate,
      activeInProcedure, newLeadsThisMonth,
      monthlyTrend, trendVsPrev, monthlyAvg,
      totalInProcedure, avgProcedurePerMonth, leadToProcedureRate,
      doctorStats,
    }
  } catch (e) {
    console.error('getDashboardData error:', e)
    return null
  }
}
