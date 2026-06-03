'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend, LabelList,
} from 'recharts'
import { Loader2, MoreHorizontal } from 'lucide-react'
import type { RawDashboardData } from './actions'
import { getDashboardRawData } from './actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const STATUS_COLORS: Record<string, string> = {
  cita_valoracion_agendada: '#3b82f6',
  asistio_a_cita:           '#10b981',
  en_tratamiento_medico:    '#f59e0b',
  cancelo_cita:             '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  nuevo_lead:               'Nuevo lead',
  cita_valoracion_agendada: 'Cita agendada',
  asistio_a_cita:           'Asistió a cita',
  en_tratamiento_medico:    'En tratamiento',
  cancelo_cita:             'Canceló cita',
  finalizado:               'Finalizado',
}

const _nowBogota    = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Bogota' }).format(new Date())
const CURRENT_YEAR  = Number(_nowBogota.slice(0, 4))
const CURRENT_MONTH = Number(_nowBogota.slice(5, 7))

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function bogotaDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(date)
}

function getWeekRange(offset: number): { from: string; to: string } {
  const d = new Date(bogotaDateStr(new Date()) + 'T12:00:00')
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  const mon = new Date(d)
  mon.setDate(d.getDate() - dow + offset * 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: bogotaDateStr(mon), to: bogotaDateStr(sun) }
}

function formatCOP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

function formatRevAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

function prevPeriodMonths(months: number[]): number[] | null {
  const n = months.length
  const sorted = [...months].sort((a, b) => a - b)
  if (sorted[0] - n < 1) return null
  return sorted.map(m => m - n)
}

// ── Metric types ──────────────────────────────────────────────────────────────

interface Metrics {
  revenueTotal: number
  revenueApts: number
  revenueProcs: number
  revenuePrev: number | null
  citasCount: number
  completedCount: number
  noShowCount: number
  cancelledCount: number
  pendingCount: number
  attendanceRate: number | null
  leadsCount: number
  leadsWithoutAppointment: number
  monthlyRevenue: { label: string; revenueCitas: number; revenueProcs: number; total: number }[]
  avgMonthlyRevenue: number
  cancellationReasons: { reason: string; count: number }[]
  leadsByStatus: { status: string; count: number }[]
  monthlyLines: { label: string; agendadas: number; asistencias: number; procedimiento: number; finalizados: number }[]
  doctorStats: {
    name: string
    total: number
    completed: number
    pct: number
    autoAssigned: number
    patientChosen: number
    inProcedure: number
    revenue: number
  }[]
  heatmapDays: { date: string; count: number }[]
  dailyApts: { date: string; label: string; count: number }[]
  thisWeek: number
  lastWeek: number
  thisMonthApts: number
  dayOfMonth: number
  projectedMonthly: number
  vsLastMonthPct: number | null
  prevMonthName: string
  thisMonthName: string
}

// ── computeMetrics ────────────────────────────────────────────────────────────

function computeMetrics(
  data: RawDashboardData,
  months: number[],
  year: number,
  currentYear: number,
  currentMonth: number,
): Metrics {
  const { appointments, yearLeads, doctors } = data
  const procedureLeads = data.procedureLeads ?? []
  const monthSet = new Set(months)
  const inPeriod = (ym: string) => {
    const [y, mo] = ym.split('-').map(Number)
    return y === year && monthSet.has(mo)
  }

  const periodApts = appointments.filter(a => inPeriod(a.ym))
  const periodProcLeads = procedureLeads.filter(pl => inPeriod(pl.procedure_month))

  // KPI 1: Revenue — completed appointments + procedure revenue
  const revenueApts = periodApts
    .filter(a => a.status === 'completed' && a.price != null)
    .reduce((s, a) => s + (a.price ?? 0), 0)
  const revenueProcs = periodProcLeads.reduce((s, pl) => s + pl.procedure_price, 0)
  const revenueTotal = revenueApts + revenueProcs

  const prevMs = prevPeriodMonths(months)
  const revenuePrev = prevMs !== null
    ? appointments
        .filter(a => {
          const [y, mo] = a.ym.split('-').map(Number)
          return y === year && prevMs.includes(mo) && a.status === 'completed' && a.price != null
        })
        .reduce((s, a) => s + (a.price ?? 0), 0)
      + procedureLeads
          .filter(pl => {
            const [y, mo] = pl.procedure_month.split('-').map(Number)
            return y === year && prevMs.includes(mo)
          })
          .reduce((s, pl) => s + pl.procedure_price, 0)
    : null

  // KPI 2: Counts
  const citasCount     = periodApts.length
  const completedCount = periodApts.filter(a => a.status === 'completed').length
  const noShowCount    = periodApts.filter(a => a.status === 'no_show').length
  const cancelledCount = periodApts.filter(a => a.status === 'cancelled').length
  const pendingCount   = periodApts.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length

  // KPI 3: Attendance rate
  const denomAtt = completedCount + noShowCount + cancelledCount
  const attendanceRate = denomAtt > 0 ? Math.round((completedCount / denomAtt) * 100) : null

  // KPI 4: Leads
  const leadsCount = yearLeads.filter(l => inPeriod(l.ym)).length
  const leadIdsWithApt = new Set(periodApts.map(a => a.lead_id).filter(Boolean))
  const leadsWithoutAppointment = yearLeads.filter(l => inPeriod(l.ym) && !leadIdsWithApt.has(l.id)).length

  // Monthly data (full year, not filtered by selected months)
  const maxMonth = year === currentYear ? currentMonth : 12
  const allYearMonths = Array.from({ length: maxMonth }, (_, i) => i + 1)

  const monthlyRevenue = allYearMonths.map(m => {
    const ym = `${year}-${pad(m)}`
    const revenueCitas = appointments
      .filter(a => a.ym === ym && a.status === 'completed' && a.price != null)
      .reduce((s, a) => s + (a.price ?? 0), 0)
    const revenueProcsMonth = procedureLeads
      .filter(pl => pl.procedure_month === ym)
      .reduce((s, pl) => s + pl.procedure_price, 0)
    return { label: MONTH_LABELS[m - 1], revenueCitas, revenueProcs: revenueProcsMonth, total: revenueCitas + revenueProcsMonth }
  })
  const activeRevMonths = monthlyRevenue.filter(mr => mr.total > 0)
  const avgMonthlyRevenue = activeRevMonths.length > 0
    ? Math.round(activeRevMonths.reduce((s, mr) => s + mr.total, 0) / activeRevMonths.length)
    : 0

  // Map: lead_id -> YM of last completed appointment (used to anchor procedure/finalizado counts)
  const lastCompletedYMByLead = new Map<string, string>()
  appointments
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .forEach(a => {
      if (a.lead_id && !lastCompletedYMByLead.has(a.lead_id)) {
        lastCompletedYMByLead.set(a.lead_id, a.ym)
      }
    })

  const monthlyLines = allYearMonths.map(m => {
    const ym = `${year}-${pad(m)}`
    return {
      label:         MONTH_LABELS[m - 1],
      agendadas:     appointments.filter(a => a.ym === ym).length,
      asistencias:   appointments.filter(a => a.ym === ym && a.status === 'completed').length,
      procedimiento: yearLeads.filter(l =>
        l.status === 'en_tratamiento_medico' &&
        lastCompletedYMByLead.get(l.id) === ym
      ).length,
      finalizados:   yearLeads.filter(l =>
        l.status === 'finalizado' &&
        lastCompletedYMByLead.get(l.id) === ym
      ).length,
    }
  })

  // Cancellation reasons from period (cancelled + no_show with feedback)
  const reasonMap = new Map<string, number>()
  periodApts.forEach(a => {
    if ((a.status === 'cancelled' || a.status === 'no_show') && a.cancellationReason) {
      reasonMap.set(a.cancellationReason, (reasonMap.get(a.cancellationReason) ?? 0) + 1)
    }
  })
  const cancellationReasons = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 5)

  // Leads by status for the period
  const leadStatusMap = new Map<string, number>()
  yearLeads.filter(l => inPeriod(l.ym)).forEach(l => {
    leadStatusMap.set(l.status, (leadStatusMap.get(l.status) ?? 0) + 1)
  })
  const leadsByStatus = Array.from(leadStatusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  // Doctor stats
  const leadDoctorMap = new Map<string, Set<string>>()
  periodApts.forEach(a => {
    if (!a.lead_id) return
    if (!leadDoctorMap.has(a.lead_id)) leadDoctorMap.set(a.lead_id, new Set())
    leadDoctorMap.get(a.lead_id)!.add(a.doctor_id)
  })
  const docMap = new Map(doctors.map(d => [
    d.id, { name: d.name, total: 0, completed: 0, noShow: 0, cancelled: 0, autoAssigned: 0, patientChosen: 0, inProcedure: 0, revenue: 0 },
  ]))
  periodApts.forEach(a => {
    const e = docMap.get(a.doctor_id)
    if (!e) return
    e.total++
    if (a.status === 'completed') {
      e.completed++
      if (a.price != null) e.revenue += a.price
    }
    if (a.status === 'no_show')   e.noShow++
    if (a.status === 'cancelled') e.cancelled++
    if (a.doctor_assignment_type === 'patient_choice') e.patientChosen++
    else e.autoAssigned++
  })
  // last apt of ANY status per lead → used for procedure count + revenue attribution
  const lastAnyDoctorByLead = new Map<string, string>()
  appointments
    .slice()
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .forEach(a => {
      if (a.lead_id && !lastAnyDoctorByLead.has(a.lead_id)) {
        lastAnyDoctorByLead.set(a.lead_id, a.doctor_id)
      }
    })

  // Procedure count: real assigned procedures in period, attributed by last apt (any status)
  docMap.forEach((entry, doctorId) => {
    entry.inProcedure = periodProcLeads.filter(pl =>
      lastAnyDoctorByLead.get(pl.lead_id) === doctorId
    ).length
  })

  // Attribute procedure revenue to same doctor as count (consistency)
  const lastCompletedDoctorByLead = new Map<string, string>()
  appointments
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .forEach(a => {
      if (a.lead_id && !lastCompletedDoctorByLead.has(a.lead_id)) {
        lastCompletedDoctorByLead.set(a.lead_id, a.doctor_id)
      }
    })
  periodProcLeads.forEach(pl => {
    const doctorId = lastAnyDoctorByLead.get(pl.lead_id)
    if (!doctorId) return
    const e = docMap.get(doctorId)
    if (e) e.revenue += pl.procedure_price
  })

  const doctorStats = Array.from(docMap.values())
    .filter(d => d.total > 0)
    .map(d => {
      const resolved = d.completed + d.noShow + d.cancelled
      return { ...d, pct: resolved > 0 ? Math.round((d.completed / resolved) * 100) : 0 }
    })
    .sort((a, b) => b.total - a.total)

  // Heatmap: last 30 days (always current, ignores year/month filter)
  const todayStr = bogotaDateStr(new Date())
  const heatmapDays: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayStr + 'T12:00:00')
    d.setDate(d.getDate() - i)
    const dateStr = bogotaDateStr(d)
    const count = appointments.filter(
      a => bogotaDateStr(new Date(a.scheduled_at)) === dateStr && a.status !== 'cancelled'
    ).length
    heatmapDays.push({ date: dateStr, count })
  }

  const dailyApts: { date: string; label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const dd = new Date(todayStr + 'T12:00:00')
    dd.setDate(dd.getDate() - i)
    const dateStr = bogotaDateStr(dd)
    const dateObj = new Date(dateStr + 'T12:00:00')
    const weekday = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'America/Bogota' })
      .format(dateObj).replace('.', '').replace(/^\S/, c => c.toUpperCase())
    const dayNum = Number(dateStr.slice(8, 10))
    const count = appointments.filter(
      a => bogotaDateStr(new Date(a.created_at)) === dateStr && a.status !== 'cancelled'
    ).length
    dailyApts.push({ date: dateStr, label: `${weekday} ${dayNum}`, count })
  }

  // Weekly stats
  const thisWeekRange = getWeekRange(0)
  const lastWeekRange = getWeekRange(-1)
  const thisWeek = appointments.filter(a => {
    const d = bogotaDateStr(new Date(a.scheduled_at))
    return a.status !== 'cancelled' && d >= thisWeekRange.from && d <= thisWeekRange.to
  }).length
  const lastWeek = appointments.filter(a => {
    const d = bogotaDateStr(new Date(a.scheduled_at))
    return a.status !== 'cancelled' && d >= lastWeekRange.from && d <= lastWeekRange.to
  }).length

  // Month progress
  const todayObj   = new Date(todayStr + 'T12:00:00')
  const dayOfMonth = todayObj.getDate()
  const thisMonthYM = todayStr.slice(0, 7)
  const thisMonthApts = appointments.filter(
    a => a.ym === thisMonthYM && a.status !== 'cancelled'
  ).length
  const projectedMonthly = dayOfMonth > 0 ? Math.round((thisMonthApts / dayOfMonth) * 30) : 0

  // vs previous month (same days elapsed)
  const prevMonthObj = new Date(todayObj)
  prevMonthObj.setMonth(prevMonthObj.getMonth() - 1)
  const prevMonthYM = bogotaDateStr(prevMonthObj).slice(0, 7)
  const prevMonthApts = appointments.filter(a => {
    if (a.ym !== prevMonthYM || a.status === 'cancelled') return false
    const dayNum = Number(bogotaDateStr(new Date(a.scheduled_at)).slice(8, 10))
    return dayNum <= dayOfMonth
  }).length
  const vsLastMonthPct = prevMonthApts > 0
    ? Math.round(((thisMonthApts - prevMonthApts) / prevMonthApts) * 100)
    : null
  const prevMonthName = MONTH_LABELS[prevMonthObj.getMonth()]
  const thisMonthName = MONTH_LABELS[todayObj.getMonth()]

  return {
    revenueTotal, revenueApts, revenueProcs, revenuePrev,
    citasCount, completedCount, noShowCount, cancelledCount, pendingCount,
    attendanceRate,
    leadsCount, leadsWithoutAppointment,
    monthlyRevenue, avgMonthlyRevenue,
    cancellationReasons,
    leadsByStatus,
    monthlyLines,
    doctorStats,
    heatmapDays, dailyApts,
    thisWeek, lastWeek,
    thisMonthApts, dayOfMonth, projectedMonthly, vsLastMonthPct,
    prevMonthName, thisMonthName,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleMouseEnter() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 })
    }
    setShow(true)
  }

  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        ref={btnRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold hover:bg-slate-300 transition"
      >?</button>
      {show && (
        <div
          className="fixed w-52 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg z-[9999] -translate-x-1/2 -translate-y-full"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  )
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm space-y-1">
      <p className="font-semibold text-slate-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const nonZero = payload.filter((p: any) => p.value > 0)
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm space-y-1">
      <p className="font-semibold text-slate-700">{label}</p>
      {nonZero.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: <strong>{formatCOP(p.value)}</strong></p>
      ))}
      {nonZero.length > 1 && (
        <p className="text-slate-700 border-t border-slate-100 pt-1">Total: <strong>{formatCOP(total)}</strong></p>
      )}
    </div>
  )
}

// Compact horizontal strip — 30 squares in one row
function HeatmapStrip({ days }: { days: { date: string; count: number }[] }) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  function cellColor(count: number): string {
    if (count === 0) return 'bg-slate-100'
    if (count === 1) return 'bg-emerald-200'
    if (count <= 3) return 'bg-emerald-300'
    if (count <= 5) return 'bg-emerald-500'
    return 'bg-emerald-600'
  }

  function fmtShort(dateStr: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric', month: 'short', timeZone: 'America/Bogota',
    }).format(new Date(dateStr + 'T12:00:00'))
  }

  function fmtFull(dateStr: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota',
    }).format(new Date(dateStr + 'T12:00:00'))
  }

  const firstDate = days[0]?.date ?? ''
  const lastDate  = days[days.length - 1]?.date ?? ''

  return (
    <div className="relative select-none">
      {/* 30-square horizontal strip */}
      <div className="flex gap-0.5 flex-wrap">
        {days.map(day => (
          <div
            key={day.date}
            style={{ width: 14, height: 14 }}
            className={`rounded-sm shrink-0 ${cellColor(day.count)} cursor-pointer hover:opacity-70 transition-opacity`}
            onMouseEnter={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setTooltip({ ...day, x: rect.left + rect.width / 2, y: rect.top })
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </div>

      {/* First / last date labels */}
      <div className="flex justify-between mt-1.5 px-0.5">
        <span className="text-[10px] text-slate-400 capitalize">{fmtShort(firstDate)}</span>
        <span className="text-[10px] text-slate-400 capitalize">{fmtShort(lastDate)}</span>
      </div>

      {/* Color scale */}
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-[10px] text-slate-400">Menos</span>
        {['bg-slate-100','bg-emerald-200','bg-emerald-300','bg-emerald-500','bg-emerald-600'].map(c => (
          <div key={c} style={{ width: 10, height: 10 }} className={`rounded-sm ${c}`} />
        ))}
        <span className="text-[10px] text-slate-400">Más</span>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <p className="font-semibold capitalize">{fmtFull(tooltip.date)}</p>
          <p className="text-slate-300">{tooltip.count} cita{tooltip.count !== 1 ? 's' : ''}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({
  initialData,
  availableYears,
  orgId,
}: {
  initialData: RawDashboardData
  availableYears: number[]
  orgId: string
}) {
  function allMonths(year: number): number[] {
    const max = year === CURRENT_YEAR ? CURRENT_MONTH : 12
    return Array.from({ length: max }, (_, i) => i + 1)
  }

  const [rawData, setRawData]               = useState(initialData)
  const [selectedYear, setSelectedYear]     = useState(CURRENT_YEAR)
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => allMonths(CURRENT_YEAR))
  const [isPending, startTransition]        = useTransition()
  const [activePreset, setActivePreset]     = useState('this_year')
  const [customOpen, setCustomOpen]         = useState(false)

  function handleYearChange(year: number) {
    if (year === selectedYear) return
    setActivePreset('custom')
    setSelectedYear(year)
    setSelectedMonths(year === CURRENT_YEAR ? [CURRENT_MONTH] : allMonths(year))
    startTransition(async () => {
      const newData = await getDashboardRawData(year, orgId)
      if (newData) setRawData(newData)
    })
  }

  function toggleMonth(mo: number) {
    setActivePreset('custom')
    setSelectedMonths(prev =>
      prev.includes(mo)
        ? prev.length > 1 ? prev.filter(x => x !== mo) : prev
        : [...prev, mo].sort((a, b) => a - b)
    )
  }

  function getPresetValues(preset: string): { year: number; months: number[] } {
    switch (preset) {
      case 'this_month':
        return { year: CURRENT_YEAR, months: [CURRENT_MONTH] }
      case 'last_month':
        return CURRENT_MONTH > 1
          ? { year: CURRENT_YEAR, months: [CURRENT_MONTH - 1] }
          : { year: CURRENT_YEAR - 1, months: [12] }
      case 'this_quarter': {
        const Q = Math.floor((CURRENT_MONTH - 1) / 3)
        const start = Q * 3 + 1
        const months: number[] = []
        for (let mo = start; mo <= start + 2 && mo <= CURRENT_MONTH; mo++) months.push(mo)
        return { year: CURRENT_YEAR, months }
      }
      case 'this_year':
        return { year: CURRENT_YEAR, months: allMonths(CURRENT_YEAR) }
      default:
        return { year: selectedYear, months: selectedMonths }
    }
  }

  function applyPreset(preset: string) {
    const { year, months } = getPresetValues(preset)
    setActivePreset(preset)
    if (year !== selectedYear) {
      setSelectedYear(year)
      setSelectedMonths(months)
      startTransition(async () => {
        const d = await getDashboardRawData(year, orgId)
        if (d) setRawData(d)
      })
    } else {
      setSelectedMonths(months)
    }
  }

  const m = useMemo(
    () => computeMetrics(rawData, selectedMonths, selectedYear, CURRENT_YEAR, CURRENT_MONTH),
    [rawData, selectedMonths, selectedYear],
  )

  const hasRevenue   = m.monthlyRevenue.some(mr => mr.total > 0)
  const weekMax      = Math.max(m.thisWeek, m.lastWeek, 1)

  const revChangeDir = m.revenuePrev != null && m.revenuePrev > 0 && m.revenueTotal !== m.revenuePrev
    ? m.revenueTotal > m.revenuePrev ? 'up' : 'down'
    : null
  const revChangePct = revChangeDir && m.revenuePrev
    ? Math.round(Math.abs((m.revenueTotal - m.revenuePrev) / m.revenuePrev) * 100)
    : null

  return (
    <div className="space-y-6">

      {/* ── Header + filtros ──────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Panel principal</p>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          </div>
          <div className="relative flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {[
                { value: 'this_month',   label: 'Este mes' },
                { value: 'last_month',   label: 'Mes pasado' },
                { value: 'this_quarter', label: 'Trimestre' },
                { value: 'this_year',    label: 'Año' },
              ].map(preset => (
                <button
                  key={preset.value}
                  onClick={() => applyPreset(preset.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    activePreset === preset.value
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setCustomOpen(v => !v)}
                className={`rounded-md px-2 py-1.5 transition ${
                  activePreset === 'custom'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Personalizado"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
            {isPending && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}

            {customOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCustomOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Año</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableYears.map(y => (
                        <button
                          key={y}
                          onClick={() => handleYearChange(y)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            selectedYear === y
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      Meses (puedes elegir varios)
                    </p>
                    <div className="grid grid-cols-4 gap-1">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(mo => {
                        const isAvail = mo <= (selectedYear === CURRENT_YEAR ? CURRENT_MONTH : 12)
                        const isSel   = selectedMonths.includes(mo)
                        return (
                          <button
                            key={mo}
                            disabled={!isAvail}
                            onClick={isAvail ? () => toggleMonth(mo) : undefined}
                            className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                              !isAvail
                                ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50'
                                : isSel
                                  ? 'bg-blue-100 text-blue-700 font-semibold'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {MONTH_LABELS[mo - 1]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => setCustomOpen(false)}
                    className="mt-4 w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                  >
                    Listo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Fila 1: 4 KPIs ───────────────────────────────────────────────── */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${isPending ? 'opacity-50' : ''}`}>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ingresos estimados</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{formatCOP(m.revenueTotal)}</p>
          {revChangePct !== null && (
            <p className={`text-xs font-semibold mt-0.5 ${revChangeDir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
              {revChangeDir === 'up' ? '↑' : '↓'} {revChangePct}% vs período anterior
            </p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">
            {m.revenueTotal > 0
              ? `${formatCOP(m.revenueApts)} citas · ${formatCOP(m.revenueProcs)} proced.`
              : 'Citas + procedimientos'
            }
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Citas del período</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{m.citasCount}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-emerald-600 font-semibold">{m.completedCount}</span> completadas ·{' '}
            <span className="text-blue-600 font-semibold">{m.pendingCount}</span> pendientes
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tasa de asistencia</p>
          {m.attendanceRate !== null ? (
            <>
              <p className={`mt-1.5 text-2xl font-bold ${
                m.attendanceRate >= 80 ? 'text-emerald-600' :
                m.attendanceRate >= 60 ? 'text-amber-500' : 'text-red-500'
              }`}>{m.attendanceRate}%</p>
              <p className="text-xs text-slate-400 mt-1">
                <span className="text-red-500 font-semibold">{m.noShowCount}</span> no asistieron
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-2xl font-bold text-slate-300">—</p>
              <p className="text-xs text-slate-400 mt-1">Sin citas finalizadas</p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Leads nuevos</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{m.leadsCount}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-amber-500 font-semibold">{m.leadsWithoutAppointment}</span> sin cita agendada
          </p>
        </div>
      </div>

      {/* ── Fila 2: Tendencia mensual (ancho completo) ────────────────────── */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="text-base font-semibold text-slate-900">Tendencia mensual</h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-4">Evolución del año completo · cantidad de citas y leads</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={m.monthlyLines} margin={{ top: 20, right: 8, left: -20, bottom: 0 }} barGap={2} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            <Bar dataKey="agendadas" name="Agendadas" fill="#6366f1" radius={[3,3,0,0]}>
              <LabelList dataKey="agendadas" position="top" style={{ fontSize: 9, fill: '#6366f1', fontWeight: 600 }} formatter={(v: any) => v || ''} />
            </Bar>
            <Bar dataKey="asistencias" name="Asistencias" fill="#10b981" radius={[3,3,0,0]}>
              <LabelList dataKey="asistencias" position="top" style={{ fontSize: 9, fill: '#10b981', fontWeight: 600 }} formatter={(v: any) => v || ''} />
            </Bar>
            <Bar dataKey="finalizados" name="Finalizados" fill="#8b5cf6" radius={[3,3,0,0]}>
              <LabelList dataKey="finalizados" position="top" style={{ fontSize: 9, fill: '#8b5cf6', fontWeight: 600 }} formatter={(v: any) => v || ''} />
            </Bar>
            <Bar dataKey="procedimiento" name="Procedimiento" fill="#f59e0b" radius={[3,3,0,0]}>
              <LabelList dataKey="procedimiento" position="top" style={{ fontSize: 9, fill: '#f59e0b', fontWeight: 600 }} formatter={(v: any) => v || ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Fila 3: Ingresos por mes + Razones cancelación ───────────────── */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity ${isPending ? 'opacity-50' : ''}`}>

        {/* Ingresos por mes */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Ingresos por mes</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">Citas + procedimientos · año completo</p>
          {!hasRevenue ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-400">Sin ingresos registrados aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.monthlyRevenue} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatRevAxis} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                {m.avgMonthlyRevenue > 0 && (
                  <ReferenceLine y={m.avgMonthlyRevenue} stroke="#475569" strokeDasharray="5 5" strokeWidth={1.5}
                    label={{ value: `Prom. ${formatRevAxis(m.avgMonthlyRevenue)}`, position: 'insideTopLeft', fontSize: 10, fill: '#475569' }} />
                )}
                <Bar dataKey="revenueCitas" name="Citas" stackId="rev" fill="#10b981" radius={[0,0,0,0]} />
                <Bar dataKey="revenueProcs" name="Procedimientos" stackId="rev" fill="#8b5cf6" radius={[4,4,0,0]}>
                  <LabelList dataKey="total" position="top" style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }}
                    formatter={(v: any) => v > 0 ? formatRevAxis(v) : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leads por estado */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Leads por estado</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-5">Distribución del período</p>
          {m.leadsByStatus.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-slate-400">Sin leads en el período</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {m.leadsByStatus.map(({ status, count }) => {
                const total = m.leadsCount || 1
                const pct = Math.round((count / total) * 100)
                const maxCount = m.leadsByStatus[0]?.count || 1
                const barWidth = Math.round((count / maxCount) * 100)
                const color = STATUS_COLORS[status] ?? '#94a3b8'
                const label = STATUS_LABELS[status] ?? status
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600 truncate mr-3">{label}</span>
                      <span className="text-xs font-bold text-slate-800 shrink-0">{count} · {pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Por médico ───────────────────────────────────────────────────── */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Por médico</h2>
        {m.doctorStats.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sin citas en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Médico</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Ingresos</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Citas</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Asistencias</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 w-36">Progreso</th>
                  <th className="py-2 px-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Paciente / Auto
                    <InfoTooltip text="Paciente: el paciente eligió este médico. Auto: el sistema lo asignó automáticamente." />
                  </th>
                  <th className="py-2 px-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Procedimientos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {m.doctorStats.map(d => (
                  <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-slate-800 text-xs leading-tight">{d.name}</td>
                    <td className="py-3 px-3 text-right text-xs font-semibold text-emerald-700">
                      {d.revenue > 0 ? formatCOP(d.revenue) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700">{d.total}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {d.completed}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              d.pct >= 70 ? 'bg-emerald-500' : d.pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${d.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 w-7 text-right shrink-0">{d.pct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-slate-600">
                      {d.patientChosen > 0 || d.autoAssigned > 0 ? (
                        <span>
                          <span className="text-blue-600 font-semibold">{d.patientChosen}</span>
                          <span className="text-slate-400"> / {d.autoAssigned}</span>
                          {d.total > 0 && (
                            <span className={`ml-1.5 text-xs font-bold ${
                              Math.round((d.patientChosen / d.total) * 100) >= 50 ? 'text-emerald-600' : 'text-amber-500'
                            }`}>
                              {Math.round((d.patientChosen / d.total) * 100)}%
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        {d.inProcedure}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Actividad de citas — heatmap compacto + métricas ────────────── */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="text-base font-semibold text-slate-900">Actividad de citas</h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-5">Últimos 30 días · citas no canceladas</p>

        <HeatmapStrip days={m.heatmapDays} />

        <div className="grid grid-cols-3 gap-3 mt-5">

          {/* Esta semana vs anterior */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Esta semana</p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <p className="text-2xl font-bold text-blue-700">{m.thisWeek}</p>
              {m.lastWeek > 0 && (
                <p className={`text-xs font-semibold ${m.thisWeek >= m.lastWeek ? 'text-emerald-600' : 'text-red-500'}`}>
                  {m.thisWeek >= m.lastWeek ? '↑' : '↓'}{Math.abs(m.thisWeek - m.lastWeek)}
                </p>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${Math.round((m.thisWeek / weekMax) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">{m.lastWeek} ant.</span>
            </div>
          </div>

          {/* Progreso del mes */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
              {m.thisMonthName} · día {m.dayOfMonth}
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1.5">{m.thisMonthApts}</p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1.5">
              → ritmo ~{m.projectedMonthly}/mes
            </p>
          </div>

          {/* vs mes anterior */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
              vs {m.prevMonthName}
            </p>
            {m.vsLastMonthPct !== null ? (
              <>
                <p className={`text-2xl font-bold mt-1.5 ${m.vsLastMonthPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {m.vsLastMonthPct >= 0 ? '+' : ''}{m.vsLastMonthPct}%
                </p>
                <p className="text-[10px] text-slate-400 mt-1.5">primeros {m.dayOfMonth} días</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-300 mt-1.5">—</p>
                <p className="text-[10px] text-slate-400 mt-1.5">sin datos anteriores</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Citas por día ────────────────────────────────────────────────── */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="text-base font-semibold text-slate-900">Agendamientos por día</h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-4">Últimos 14 días · citas creadas</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={m.dailyApts} margin={{ top: 18, right: 4, left: 4, bottom: 0 }} barCategoryGap="30%">
            <defs>
              <linearGradient id="dailyBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="count" name="Citas" fill="url(#dailyBarGrad)" radius={[4,4,0,0]}>
              <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: '#6366f1', fontWeight: 600 }}
                formatter={(v: any) => v || ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Razones de cancelación (ancho completo, compacto) ────────────── */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-base font-semibold text-slate-900">Razones de cancelación y no-show</h2>
          <span className="text-xs text-slate-400">
            Del período · {m.noShowCount + m.cancelledCount} cita{m.noShowCount + m.cancelledCount !== 1 ? 's' : ''} afectada{m.noShowCount + m.cancelledCount !== 1 ? 's' : ''}
          </span>
        </div>
        {m.cancellationReasons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 gap-1.5">
            <p className="text-sm font-medium text-slate-500">Sin datos de feedback aún</p>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              Cuando los pacientes dejen feedback desde el email de cancelación, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
            {m.cancellationReasons.map((r) => {
              const maxCount = m.cancellationReasons[0].count
              const pct = Math.round((r.count / maxCount) * 100)
              return (
                <div key={r.reason}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 truncate mr-3 max-w-[75%]">{r.reason}</span>
                    <span className="text-xs font-bold text-slate-800 shrink-0">{r.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
