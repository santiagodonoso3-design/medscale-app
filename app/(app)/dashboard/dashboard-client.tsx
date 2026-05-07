'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  Loader2, ArrowRight,
} from 'lucide-react'
import type { RawDashboardData } from './actions'
import { getDashboardRawData } from './actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function bogotaDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(date)
}

function getWeekRange(offset: number): { from: string; to: string } {
  const d = new Date(bogotaDateStr(new Date()) + 'T12:00:00')
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1  // Mon=0
  const mon = new Date(d)
  mon.setDate(d.getDate() - dow + offset * 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: bogotaDateStr(mon), to: bogotaDateStr(sun) }
}

function convPct(num: number, den: number): number | null {
  if (den === 0) return null
  return Math.round((num / den) * 100)
}

// ── Metric computation ────────────────────────────────────────────────────────

interface Metrics {
  leadsCount: number
  citasCount: number
  attendedCount: number
  inProcedureCount: number
  monthlyLines: { label: string; agendadas: number; asistencias: number }[]
  thisWeek: number
  lastWeek: number
  monthAvg: number
  doctorStats: {
    name: string
    total: number
    completed: number
    pct: number
    autoAssigned: number
    patientChosen: number
  }[]
}

function computeMetrics(data: RawDashboardData, months: number[], year: number): Metrics {
  const { appointments, yearLeads, inProcedureCount, doctors } = data
  const monthSet = new Set(months)
  const inPeriod = (ym: string) =>
    Number(ym.slice(0, 4)) === year && monthSet.has(Number(ym.slice(5)))

  // Funnel
  const leadsCount    = yearLeads.filter(l => inPeriod(l.ym)).length
  const citasCount    = appointments.filter(a => inPeriod(a.ym) && a.status !== 'cancelled').length
  const attendedCount = appointments.filter(a => inPeriod(a.ym) && a.status === 'completed').length

  // Monthly lines
  const sortedMonths = [...months].sort((a, b) => a - b)
  const monthlyLines = sortedMonths.map(m => ({
    label: MONTH_LABELS[m - 1],
    agendadas:   appointments.filter(a => a.ym === `${year}-${pad(m)}` && a.status !== 'cancelled').length,
    asistencias: appointments.filter(a => a.ym === `${year}-${pad(m)}` && a.status === 'completed').length,
  }))

  // Weekly (uses raw scheduled_at, independent of year filter)
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
  const docMap = new Map(doctors.map(d => [
    d.id, { name: d.name, total: 0, completed: 0, autoAssigned: 0, patientChosen: 0 }
  ]))
  appointments.forEach(a => {
    if (!inPeriod(a.ym) || a.status === 'cancelled') return
    const e = docMap.get(a.doctor_id)
    if (!e) return
    e.total++
    if (a.status === 'completed') e.completed++
    if (a.doctor_assignment_type === 'patient_choice') e.patientChosen++
    else e.autoAssigned++
  })
  const doctorStats = Array.from(docMap.values())
    .filter(d => d.total > 0)
    .map(d => ({ ...d, pct: Math.round((d.completed / d.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  return {
    leadsCount, citasCount, attendedCount, inProcedureCount,
    monthlyLines, thisWeek, lastWeek, monthAvg, doctorStats,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FunnelBlock({ steps }: {
  steps: { label: string; count: number; bg: string; text: string }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className={`rounded-2xl ${step.bg} px-5 py-4 text-center min-w-[110px]`}>
            <p className={`text-3xl font-bold ${step.text}`}>{step.count}</p>
            <p className="mt-1 text-xs font-medium text-slate-500 leading-tight">{step.label}</p>
          </div>
          {i < steps.length - 1 && (
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <ArrowRight className="h-4 w-4 text-slate-300" />
              {(() => {
                const p = convPct(steps[i + 1].count, step.count)
                if (p === null) return null
                return (
                  <span className={`text-[10px] font-bold ${p >= 50 ? 'text-emerald-600' : p >= 25 ? 'text-amber-500' : 'text-red-400'}`}>
                    {p}%
                  </span>
                )
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
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
  const [selectedMonths, setSelectedMonths] = useState<number[]>([currentMonth])
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
        ? prev.length > 1 ? prev.filter(x => x !== m) : prev
        : [...prev, m].sort((a, b) => a - b)
    )
  }

  const available   = allMonths(selectedYear)
  const allSelected = selectedMonths.length === available.length

  const m = useMemo(
    () => computeMetrics(rawData, selectedMonths, selectedYear),
    [rawData, selectedMonths, selectedYear]
  )

  const funnelSteps = [
    { label: 'Leads',            count: m.leadsCount,        bg: 'bg-slate-100',   text: 'text-slate-700' },
    { label: 'Citas agendadas',  count: m.citasCount,        bg: 'bg-violet-50',   text: 'text-violet-700' },
    { label: 'Asistieron',       count: m.attendedCount,     bg: 'bg-emerald-50',  text: 'text-emerald-700' },
    { label: 'En procedimiento', count: m.inProcedureCount,  bg: 'bg-amber-50',    text: 'text-amber-700' },
  ]

  const weekMax = Math.max(m.thisWeek, m.lastWeek, m.monthAvg, 1)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Panel principal</p>
        <h1 className="mt-0.5 text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Lead → Cita agendada → Asistió → En procedimiento</p>
      </div>

      {/* Date filter */}
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">Año</span>
          {availableYears.map(y => (
            <button key={y} onClick={() => handleYearChange(y)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                selectedYear === y ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{y}</button>
          ))}
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400 ml-1" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">Mes</span>
          <button onClick={() => setSelectedMonths(allMonths(selectedYear))}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              allSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>Todos</button>
          {available.map(mo => (
            <button key={mo} onClick={() => toggleMonth(mo)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                selectedMonths.includes(mo) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{MONTH_LABELS[mo - 1]}</button>
          ))}
        </div>
      </div>

      {/* Bloque 1 — Funnel visual */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="mb-5 text-base font-semibold text-slate-900">Funnel de conversión</h2>
        <FunnelBlock steps={funnelSteps} />
        <div className="mt-4 flex flex-wrap gap-4">
          {[
            { label: 'Lead → Cita', v: convPct(m.citasCount, m.leadsCount) },
            { label: 'Cita → Asistencia', v: convPct(m.attendedCount, m.citasCount) },
            { label: 'Asistencia → Procedimiento', v: convPct(m.inProcedureCount, m.attendedCount) },
          ].map(({ label, v }) => v !== null && (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>{label}</span>
              <span className={`font-bold ${v >= 50 ? 'text-emerald-600' : v >= 25 ? 'text-amber-500' : 'text-red-400'}`}>{v}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bloque 2 — Tendencia mensual (ancho completo) */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="text-base font-semibold text-slate-900">Tendencia mensual</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-400">Agendadas vs Asistencias · meses seleccionados</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={m.monthlyLines} margin={{ top: 4, right: 16, left: -20, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="agendadas"   name="Agendadas"   fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="asistencias" name="Asistencias" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bloque 3 — Agendamiento semanal (ancho completo) */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="text-base font-semibold text-slate-900">Agendamiento semanal</h2>
        <p className="mt-0.5 mb-5 text-xs text-slate-400">Citas no canceladas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Esta semana',     value: m.thisWeek, bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-500' },
            { label: 'Semana anterior', value: m.lastWeek, bg: 'bg-slate-50',  text: 'text-slate-700',  bar: 'bg-slate-400' },
            { label: 'Prom. del mes',   value: m.monthAvg, bg: 'bg-violet-50', text: 'text-violet-700', bar: 'bg-violet-500', suffix: '/sem' },
          ].map(item => (
            <div key={item.label} className={`rounded-2xl ${item.bg} px-4 py-3.5`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">{item.label}</p>
                <p className={`text-xl font-bold ${item.text}`}>{item.value}{item.suffix ?? ''}</p>
              </div>
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.bar} rounded-full transition-all`}
                  style={{ width: `${Math.round((item.value / weekMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {m.lastWeek > 0 && (
          <p className={`mt-3 text-xs font-semibold text-center ${m.thisWeek >= m.lastWeek ? 'text-emerald-600' : 'text-red-500'}`}>
            {m.thisWeek >= m.lastWeek ? '↑' : '↓'} {Math.abs(m.thisWeek - m.lastWeek)} vs sem. anterior
          </p>
        )}
      </div>

      {/* Bloque 4 — Por médico */}
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
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Citas</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Asistencias</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">% Asist.</th>
                  <th className="py-2 px-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Paciente / Auto</th>
                  <th className="py-2 pl-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 w-36">Progreso asistencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {m.doctorStats.map(d => (
                  <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-slate-800 text-xs leading-tight">{d.name}</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700">{d.total}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {d.completed}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`text-xs font-bold ${d.pct >= 70 ? 'text-emerald-600' : d.pct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                        {d.pct}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-slate-600">
                      {d.patientChosen > 0 || d.autoAssigned > 0
                        ? <span><span className="text-blue-600 font-semibold">{d.patientChosen}</span> / <span className="text-slate-500">{d.autoAssigned}</span></span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full transition-all ${d.pct >= 70 ? 'bg-emerald-500' : d.pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${d.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 w-7 text-right shrink-0">{d.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
