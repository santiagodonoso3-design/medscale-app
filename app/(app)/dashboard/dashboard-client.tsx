'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { Loader2, AlertTriangle } from 'lucide-react'
import type { RawDashboardData } from './actions'
import { getDashboardRawData } from './actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const _nowBogota   = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Bogota' }).format(new Date())
const CURRENT_YEAR  = Number(_nowBogota.slice(0, 4))
const CURRENT_MONTH = Number(_nowBogota.slice(5, 7))

const TODAY_LABEL = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'long', timeZone: 'America/Bogota',
}).format(new Date())

const APT_STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  scheduled: { text: 'Programada',  cls: 'bg-blue-100 text-blue-700' },
  confirmed: { text: 'Confirmada',  cls: 'bg-sky-100 text-sky-700' },
  completed: { text: 'Completada',  cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { text: 'Cancelada',   cls: 'bg-slate-100 text-slate-400' },
  no_show:   { text: 'No asistió',  cls: 'bg-red-100 text-red-700' },
}

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

function formatTime12h(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota',
  }).format(new Date(iso))
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
  revenuePrev: number | null
  citasCount: number
  completedCount: number
  noShowCount: number
  cancelledCount: number
  pendingCount: number
  attendanceRate: number | null
  leadsCount: number
  leadsWithoutAppointment: number
  funnelCitasConLead: number
  funnelAsistieron: number
  inProcedureCount: number
  monthlyRevenue: { label: string; revenue: number }[]
  avgMonthlyRevenue: number
  monthlyNoShows: { label: string; no_shows: number; cancelled: number }[]
  noShowRate: number | null
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
  thisWeek: number
  lastWeek: number
  monthAvg: number
  avgAsistencias: number
  monthlyLines: { label: string; agendadas: number; asistencias: number; procedimiento: number; finalizados: number }[]
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
  const monthSet = new Set(months)
  const inPeriod = (ym: string) => {
    const [y, mo] = ym.split('-').map(Number)
    return y === year && monthSet.has(mo)
  }

  const periodApts = appointments.filter(a => inPeriod(a.ym))

  // KPI 1: Revenue
  const revenueTotal = periodApts
    .filter(a => a.status === 'completed' && a.price != null)
    .reduce((s, a) => s + (a.price ?? 0), 0)

  const prevMs = prevPeriodMonths(months)
  const revenuePrev = prevMs !== null
    ? appointments
        .filter(a => {
          const mNum = Number(a.ym.slice(5))
          const yNum = Number(a.ym.slice(0, 4))
          return yNum === year && prevMs.includes(mNum) && a.status === 'completed' && a.price != null
        })
        .reduce((s, a) => s + (a.price ?? 0), 0)
    : null

  // KPI 2: Appointment counts
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

  // Funnel
  const funnelCitasConLead = yearLeads.filter(l => inPeriod(l.ym) && leadIdsWithApt.has(l.id)).length
  const leadIdsCompleted = new Set(
    periodApts.filter(a => a.status === 'completed').map(a => a.lead_id).filter(Boolean)
  )
  const funnelAsistieron = yearLeads.filter(l => inPeriod(l.ym) && leadIdsCompleted.has(l.id)).length
  const inProcedureCount = yearLeads.filter(l => inPeriod(l.ym) && l.status === 'en_tratamiento_medico').length

  // Monthly data (always full year, not filtered by month)
  const maxMonth = year === currentYear ? currentMonth : 12
  const allYearMonths = Array.from({ length: maxMonth }, (_, i) => i + 1)

  const monthlyRevenue = allYearMonths.map(m => {
    const ym = `${year}-${pad(m)}`
    const rev = appointments
      .filter(a => a.ym === ym && a.status === 'completed' && a.price != null)
      .reduce((s, a) => s + (a.price ?? 0), 0)
    return { label: MONTH_LABELS[m - 1], revenue: rev }
  })
  const activeRevMonths = monthlyRevenue.filter(mr => mr.revenue > 0)
  const avgMonthlyRevenue = activeRevMonths.length > 0
    ? Math.round(activeRevMonths.reduce((s, mr) => s + mr.revenue, 0) / activeRevMonths.length)
    : 0

  const monthlyNoShows = allYearMonths.map(m => {
    const ym = `${year}-${pad(m)}`
    return {
      label:     MONTH_LABELS[m - 1],
      no_shows:  appointments.filter(a => a.ym === ym && a.status === 'no_show').length,
      cancelled: appointments.filter(a => a.ym === ym && a.status === 'cancelled').length,
    }
  })
  const noShowRate = citasCount > 0 ? Math.round((noShowCount / citasCount) * 100) : null

  const monthlyLines = allYearMonths.map(m => {
    const ym = `${year}-${pad(m)}`
    return {
      label:         MONTH_LABELS[m - 1],
      agendadas:     appointments.filter(a => a.ym === ym).length,
      asistencias:   appointments.filter(a => a.ym === ym && a.status === 'completed').length,
      procedimiento: yearLeads.filter(l => l.ym === ym && l.status === 'en_tratamiento_medico').length,
      finalizados:   yearLeads.filter(l => l.ym === ym && l.status === 'finalizado').length,
    }
  })
  const activeMths = monthlyLines.filter(ml => ml.agendadas > 0)
  const avgAsistencias = activeMths.length > 0
    ? Math.round(activeMths.reduce((s, ml) => s + ml.asistencias, 0) / activeMths.length)
    : 0

  // Weekly
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
  const nowM = new Date().getMonth() + 1
  const thisMonthTotal = appointments.filter(a =>
    a.ym === `${year}-${pad(nowM)}` && a.status !== 'cancelled'
  ).length
  const monthAvg = Math.round(thisMonthTotal / 4)

  // Doctor stats
  const leadDoctorMap = new Map<string, Set<string>>()
  periodApts.forEach(a => {
    if (!a.lead_id) return
    if (!leadDoctorMap.has(a.lead_id)) leadDoctorMap.set(a.lead_id, new Set())
    leadDoctorMap.get(a.lead_id)!.add(a.doctor_id)
  })

  const docMap = new Map(doctors.map(d => [
    d.id, { name: d.name, total: 0, completed: 0, autoAssigned: 0, patientChosen: 0, inProcedure: 0, revenue: 0 },
  ]))
  periodApts.forEach(a => {
    const e = docMap.get(a.doctor_id)
    if (!e) return
    e.total++
    if (a.status === 'completed') {
      e.completed++
      if (a.price != null) e.revenue += a.price
    }
    if (a.doctor_assignment_type === 'patient_choice') e.patientChosen++
    else e.autoAssigned++
  })
  docMap.forEach((entry, doctorId) => {
    entry.inProcedure = yearLeads.filter(l =>
      inPeriod(l.ym) &&
      l.status === 'en_tratamiento_medico' &&
      leadDoctorMap.get(l.id)?.has(doctorId)
    ).length
  })
  const doctorStats = Array.from(docMap.values())
    .filter(d => d.total > 0)
    .map(d => ({ ...d, pct: Math.round((d.completed / d.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  return {
    revenueTotal, revenuePrev,
    citasCount, completedCount, noShowCount, cancelledCount, pendingCount,
    attendanceRate,
    leadsCount, leadsWithoutAppointment,
    funnelCitasConLead, funnelAsistieron, inProcedureCount,
    monthlyRevenue, avgMonthlyRevenue,
    monthlyNoShows, noShowRate,
    doctorStats,
    thisWeek, lastWeek, monthAvg,
    avgAsistencias, monthlyLines,
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
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm space-y-1">
      <p className="font-semibold text-slate-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: <strong>{formatCOP(p.value)}</strong></p>
      ))}
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

  function handleYearChange(year: number) {
    if (year === selectedYear) return
    setSelectedYear(year)
    setSelectedMonths(year === CURRENT_YEAR ? [CURRENT_MONTH] : allMonths(year))
    startTransition(async () => {
      const newData = await getDashboardRawData(year, orgId)
      if (newData) setRawData(newData)
    })
  }

  function toggleMonth(mo: number) {
    setSelectedMonths(prev =>
      prev.includes(mo)
        ? prev.length > 1 ? prev.filter(x => x !== mo) : prev
        : [...prev, mo].sort((a, b) => a - b)
    )
  }

  const available   = allMonths(selectedYear)
  const allSelected = selectedMonths.length === available.length

  const m = useMemo(
    () => computeMetrics(rawData, selectedMonths, selectedYear, CURRENT_YEAR, CURRENT_MONTH),
    [rawData, selectedMonths, selectedYear],
  )

  const funnelData = [
    { label: 'Leads',          count: m.leadsCount,          color: 'bg-slate-400' },
    { label: 'Cita agendada',  count: m.funnelCitasConLead,  color: 'bg-violet-500' },
    { label: 'Asistió',        count: m.funnelAsistieron,    color: 'bg-emerald-500' },
    { label: 'En tratamiento', count: m.inProcedureCount,    color: 'bg-amber-500' },
  ]
  const funnelMax = Math.max(...funnelData.map(f => f.count), 1)

  const weekMax = Math.max(m.thisWeek, m.lastWeek, m.monthAvg, 1)

  const hasRevenue = m.monthlyRevenue.some(mr => mr.revenue > 0)
  const isHighNoShow = m.noShowRate !== null && m.noShowRate > 15

  const revChangeDir  = m.revenuePrev != null && m.revenuePrev > 0 && m.revenueTotal !== m.revenuePrev
    ? m.revenueTotal > m.revenuePrev ? 'up' : 'down'
    : null
  const revChangePct  = revChangeDir && m.revenuePrev
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
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Año</span>
              {availableYears.map(y => (
                <button key={y} onClick={() => handleYearChange(y)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    selectedYear === y ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{y}</button>
              ))}
              {isPending && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button onClick={() => setSelectedMonths(allMonths(selectedYear))}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  allSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>Todos</button>
              {available.map(mo => (
                <button key={mo} onClick={() => toggleMonth(mo)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    selectedMonths.includes(mo) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{MONTH_LABELS[mo - 1]}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fila 1: 4 KPIs ───────────────────────────────────────────────── */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${isPending ? 'opacity-50' : ''}`}>

        {/* KPI 1: Ingresos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ingresos estimados</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{formatCOP(m.revenueTotal)}</p>
          {revChangePct !== null ? (
            <p className={`text-xs font-semibold mt-1 ${revChangeDir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
              {revChangeDir === 'up' ? '↑' : '↓'} {revChangePct}% vs período anterior
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Citas completadas</p>
          )}
        </div>

        {/* KPI 2: Citas del período */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Citas del período</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{m.citasCount}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-emerald-600 font-semibold">{m.completedCount}</span> completadas ·{' '}
            <span className="text-blue-600 font-semibold">{m.pendingCount}</span> pendientes
          </p>
        </div>

        {/* KPI 3: Tasa de asistencia */}
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

        {/* KPI 4: Leads nuevos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Leads nuevos</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{m.leadsCount}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-amber-500 font-semibold">{m.leadsWithoutAppointment}</span> sin cita agendada
          </p>
        </div>
      </div>

      {/* ── Fila 2: Hoy + Ingresos por mes ───────────────────────────────── */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity ${isPending ? 'opacity-50' : ''}`}>

        {/* Citas de hoy */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Hoy, {TODAY_LABEL}</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">Citas del día</p>
          {rawData.todayAppointments.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-slate-400">No hay citas programadas para hoy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rawData.todayAppointments.map(apt => {
                const badge = APT_STATUS_BADGE[apt.status] ?? { text: apt.status, cls: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={apt.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                    <span className="text-xs font-bold text-slate-700 w-[68px] shrink-0 tabular-nums">
                      {formatTime12h(apt.scheduled_at)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {apt.patientName || 'Sin nombre'}
                      </p>
                      {apt.doctorName && (
                        <p className="text-[10px] text-slate-400 truncate">{apt.doctorName}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Ingresos por mes */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Ingresos por mes</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">Citas completadas · año completo</p>
          {!hasRevenue ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-400">Sin ingresos registrados aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={m.monthlyRevenue} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatRevAxis} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: '#f8fafc' }} />
                {m.avgMonthlyRevenue > 0 && (
                  <ReferenceLine y={m.avgMonthlyRevenue} stroke="#10b981" strokeDasharray="5 5" strokeWidth={1.5}
                    label={{ value: `Prom. ${formatRevAxis(m.avgMonthlyRevenue)}`, position: 'insideTopLeft', fontSize: 10, fill: '#10b981' }} />
                )}
                <Bar dataKey="revenue" name="Ingresos" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Fila 2b: Tendencia mensual ───────────────────────────────────── */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="text-base font-semibold text-slate-900">Tendencia mensual</h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-4">Evolución del año completo · cantidad de citas y leads</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={m.monthlyLines} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={2} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            <Bar dataKey="agendadas"     name="Agendadas"     fill="#64748b" radius={[3,3,0,0]} />
            <Bar dataKey="asistencias"   name="Asistencias"   fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="procedimiento" name="Procedimiento" fill="#f59e0b" radius={[3,3,0,0]} />
            <Bar dataKey="finalizados"   name="Finalizados"   fill="#8b5cf6" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Fila 3: Funnel + No-shows ─────────────────────────────────────── */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity ${isPending ? 'opacity-50' : ''}`}>

        {/* Funnel de conversión */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Funnel de conversión</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-5">Del período seleccionado</p>
          {m.leadsCount === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-slate-400">Sin leads en el período</p>
            </div>
          ) : (
            <div className="space-y-4">
              {funnelData.map((step, i) => {
                const prevCount = i > 0 ? funnelData[i - 1].count : null
                const pct = prevCount !== null && prevCount > 0
                  ? Math.round((step.count / prevCount) * 100)
                  : null
                const barWidth = Math.round((step.count / funnelMax) * 100)
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-600">{step.label}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-slate-900">{step.count}</span>
                        {pct !== null && (
                          <span className={`text-xs font-semibold ${
                            pct >= 50 ? 'text-emerald-600' : pct >= 25 ? 'text-amber-600' : 'text-red-500'
                          }`}>{pct}%</span>
                        )}
                      </div>
                    </div>
                    <div className="h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${step.color} rounded-full transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* No-shows y cancelaciones */}
        <div className={`rounded-3xl border bg-white p-6 shadow-sm transition-all ${
          isHighNoShow ? 'border-red-300' : 'border-slate-200'
        }`}>
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-base font-semibold text-slate-900">No-shows y cancelaciones</h2>
            {isHighNoShow && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
          </div>
          <div className="flex items-end gap-5 mb-4">
            <div>
              <p className={`text-3xl font-black ${
                m.noShowRate !== null && m.noShowRate > 15 ? 'text-red-500' :
                m.noShowRate !== null && m.noShowRate > 5  ? 'text-amber-500' : 'text-slate-700'
              }`}>
                {m.noShowRate !== null ? `${m.noShowRate}%` : '—'}
              </p>
              <p className="text-xs text-slate-400">tasa no-show del período</p>
            </div>
            <div className="text-xs text-slate-500 space-y-0.5 mb-0.5">
              <p><span className="font-semibold text-red-500">{m.noShowCount}</span> no asistieron</p>
              <p><span className="font-semibold text-orange-500">{m.cancelledCount}</span> canceladas</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={m.monthlyNoShows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              <Bar dataKey="no_shows"  name="No asistió"  fill="#ef4444" radius={[3,3,0,0]} />
              <Bar dataKey="cancelled" name="Cancelada"   fill="#f97316" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Fila 4: Por médico ────────────────────────────────────────────── */}
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

      {/* ── Fila 5: Agendamiento semanal (compacto) ───────────────────────── */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Agendamiento semanal</h2>
            <p className="text-xs text-slate-400">Citas no canceladas</p>
          </div>
          {m.lastWeek > 0 && (
            <p className={`text-xs font-semibold ${m.thisWeek >= m.lastWeek ? 'text-emerald-600' : 'text-red-500'}`}>
              {m.thisWeek >= m.lastWeek ? '↑' : '↓'} {Math.abs(m.thisWeek - m.lastWeek)} vs sem. anterior
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {[
            { label: 'Esta semana',  value: m.thisWeek, textColor: 'text-blue-700',   bg: 'bg-blue-50',   bar: 'bg-blue-500' },
            { label: 'Sem. anterior', value: m.lastWeek, textColor: 'text-slate-700',  bg: 'bg-slate-50',  bar: 'bg-slate-400' },
            { label: 'Prom. mes',    value: m.monthAvg, textColor: 'text-violet-700', bg: 'bg-violet-50', bar: 'bg-violet-500', suffix: '/sem' },
          ].map(item => (
            <div key={item.label} className={`flex-1 rounded-xl ${item.bg} px-3 py-2.5`}>
              <p className={`text-xl font-bold ${item.textColor}`}>{item.value}{item.suffix ?? ''}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{item.label}</p>
              <div className="mt-1.5 h-1 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.bar} rounded-full`}
                  style={{ width: `${Math.round((item.value / weekMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
