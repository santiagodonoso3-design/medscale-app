'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, CalendarDays,
  Activity, Stethoscope, MessageCircle, Loader2,
} from 'lucide-react'
import type { RawDashboardData } from './actions'
import { getDashboardRawData } from './actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed:  'bg-sky-100 text-sky-700',
  completed:  'bg-emerald-100 text-emerald-700',
  cancelled:  'bg-slate-100 text-slate-400',
  no_show:    'bg-orange-100 text-orange-700',
}
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programada',
  confirmed:  'Confirmada',
  completed:  'Completada',
  cancelled:  'Cancelada',
  no_show:    'No asistió',
}

// ── Client-side metric computation ────────────────────────────────────────────

interface Metrics {
  leadsCount: number
  inConversationCount: number
  inProcedureCount: number
  citasCount: number
  attendedCount: number
  monthlyTrend: { label: string; count: number }[]
  monthlyAvg: number
  trendVsPrev: number | null
  doctorStats: { name: string; total: number; completed: number }[]
}

function computeMetrics(data: RawDashboardData, months: number[], year: number): Metrics {
  const { appointments, yearLeads, inConversationCount, inProcedureCount, doctors } = data
  const monthSet = new Set(months)

  const inPeriod = (ym: string) =>
    Number(ym.slice(0, 4)) === year && monthSet.has(Number(ym.slice(5)))

  const leadsCount    = yearLeads.filter(l => inPeriod(l.ym)).length
  const citasCount    = appointments.filter(a => inPeriod(a.ym) && a.status !== 'cancelled').length
  const attendedCount = appointments.filter(a => inPeriod(a.ym) && a.status === 'completed').length

  const sortedMonths = [...months].sort((a, b) => a - b)
  const monthlyTrend = sortedMonths.map(m => ({
    label: MONTH_LABELS[m - 1],
    count: appointments.filter(a =>
      a.ym === `${year}-${String(m).padStart(2, '0')}` && a.status !== 'cancelled'
    ).length,
  }))

  const monthlyAvg = monthlyTrend.length
    ? Math.round(monthlyTrend.reduce((s, p) => s + p.count, 0) / monthlyTrend.length)
    : 0

  // Compare last selected month vs the month immediately before it
  const lastM      = sortedMonths[sortedMonths.length - 1]
  const prevM      = lastM > 1 ? lastM - 1 : null
  const lastCount  = monthlyTrend[monthlyTrend.length - 1]?.count ?? 0
  const prevCount  = prevM
    ? appointments.filter(a =>
        a.ym === `${year}-${String(prevM).padStart(2, '0')}` && a.status !== 'cancelled'
      ).length
    : 0
  const trendVsPrev = prevCount > 0
    ? Math.round(((lastCount - prevCount) / prevCount) * 100)
    : null

  const docMap = new Map(doctors.map(d => [d.id, { name: d.name, total: 0, completed: 0 }]))
  appointments.forEach(a => {
    if (!inPeriod(a.ym)) return
    const e = docMap.get(a.doctor_id)
    if (!e) return
    e.total++
    if (a.status === 'completed') e.completed++
  })
  const doctorStats = Array.from(docMap.values())
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total)

  return {
    leadsCount, inConversationCount, inProcedureCount,
    citasCount, attendedCount,
    monthlyTrend, monthlyAvg, trendVsPrev,
    doctorStats,
  }
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, accent, step }: {
  label: string; value: number; icon: React.ElementType; accent: string; step: number
}) {
  return (
    <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
      <span className="absolute top-3 right-3 text-[10px] font-bold text-slate-200 select-none">#{step}</span>
      <div className={`mb-3 inline-flex rounded-xl p-2 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-blue-600">{payload[0].value} citas</p>
    </div>
  )
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({
  initialData,
  availableYears,
}: {
  initialData: RawDashboardData
  availableYears: number[]
}) {
  const nowBogota    = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Bogota',
  }).format(new Date())
  const currentYear  = Number(nowBogota.slice(0, 4))
  const currentMonth = Number(nowBogota.slice(5, 7))

  function allMonths(year: number): number[] {
    const max = year === currentYear ? currentMonth : 12
    return Array.from({ length: max }, (_, i) => i + 1)
  }

  const [rawData, setRawData]               = useState(initialData)
  const [selectedYear, setSelectedYear]     = useState(initialData.year)
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => allMonths(initialData.year))
  const [isPending, startTransition]        = useTransition()

  function handleYearChange(year: number) {
    if (year === selectedYear) return
    setSelectedYear(year)
    setSelectedMonths(allMonths(year))
    startTransition(async () => {
      const newData = await getDashboardRawData(year)
      if (newData) setRawData(newData)
    })
  }

  function toggleMonth(m: number) {
    setSelectedMonths(prev =>
      prev.includes(m)
        ? prev.length > 1 ? prev.filter(x => x !== m) : prev  // prevent empty selection
        : [...prev, m].sort((a, b) => a - b)
    )
  }

  const available  = allMonths(selectedYear)
  const allSelected = selectedMonths.length === available.length

  const metrics = useMemo(
    () => computeMetrics(rawData, selectedMonths, selectedYear),
    [rawData, selectedMonths, selectedYear]
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Panel principal</p>
        <h1 className="mt-0.5 text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Funnel Lead → Conversación → Cita → Asistencia → Procedimiento</p>
      </div>

      {/* Date filter */}
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm space-y-3">
        {/* Year pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">Año</span>
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => handleYearChange(y)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                selectedYear === y
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {y}
            </button>
          ))}
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400 ml-1" />}
        </div>

        {/* Month chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">Mes</span>
          <button
            onClick={() => setSelectedMonths(allMonths(selectedYear))}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              allSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          {available.map(m => (
            <button
              key={m}
              onClick={() => toggleMonth(m)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                selectedMonths.includes(m) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {MONTH_LABELS[m - 1]}
            </button>
          ))}
        </div>
      </div>

      {/* Funnel KPIs */}
      <div className={`grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <KpiCard step={1} label="Leads en período"  value={metrics.leadsCount}          icon={Users}         accent="bg-slate-100 text-slate-500" />
        <KpiCard step={2} label="En conversación"   value={metrics.inConversationCount} icon={MessageCircle} accent="bg-blue-50 text-blue-500" />
        <KpiCard step={3} label="Citas agendadas"   value={metrics.citasCount}          icon={CalendarDays}  accent="bg-violet-50 text-violet-500" />
        <KpiCard step={4} label="Asistieron"        value={metrics.attendedCount}       icon={Activity}      accent="bg-emerald-50 text-emerald-600" />
        <KpiCard step={5} label="En procedimiento"  value={metrics.inProcedureCount}    icon={Stethoscope}   accent="bg-amber-50 text-amber-600" />
      </div>

      {/* Citas de hoy — ignores all filters */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Citas de hoy
          {rawData.todayAppointments.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">
              {rawData.todayAppointments.length}
            </span>
          )}
        </h2>
        {rawData.todayAppointments.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 py-8 text-center">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">No hay citas programadas para hoy.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Hora</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Paciente</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Médico</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rawData.todayAppointments.map(apt => (
                  <tr key={apt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{fmtTime(apt.scheduled_at)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{apt.patientName ?? 'Sin nombre'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{apt.doctorName ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABEL[apt.status] ?? apt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chart + Doctor table */}
      <div className={`grid gap-4 xl:grid-cols-3 transition-opacity ${isPending ? 'opacity-50' : ''}`}>

        {/* Chart */}
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Agendamientos por mes</h2>
              <p className="mt-0.5 text-xs text-slate-400">Meses seleccionados · citas no canceladas</p>
            </div>
            {metrics.trendVsPrev !== null && (
              <div className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                metrics.trendVsPrev >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}>
                {metrics.trendVsPrev >= 0
                  ? <TrendingUp className="h-3.5 w-3.5" />
                  : <TrendingDown className="h-3.5 w-3.5" />}
                {metrics.trendVsPrev >= 0 ? '+' : ''}{metrics.trendVsPrev}% vs mes ant.
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.monthlyTrend} margin={{ top: 4, right: 40, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              {metrics.monthlyAvg > 0 && (
                <ReferenceLine
                  y={metrics.monthlyAvg}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: `Prom ${metrics.monthlyAvg}`, position: 'right', fontSize: 10, fill: '#94a3b8' }}
                />
              )}
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Doctor table */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Por médico</h2>
          {metrics.doctorStats.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Sin citas registradas.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Médico</th>
                  <th className="py-2 px-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Citas</th>
                  <th className="py-2 px-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Asistieron</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {metrics.doctorStats.map(d => (
                  <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pr-2 font-medium text-slate-800 text-xs leading-tight">{d.name}</td>
                    <td className="py-2.5 px-2 text-right text-slate-700">{d.total}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {d.completed}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  )
}
