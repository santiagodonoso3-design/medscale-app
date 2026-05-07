'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'
import {
  Loader2, ArrowRight,
} from 'lucide-react'
import type { RawDashboardData } from './actions'
import { getDashboardRawData } from './actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const _nowBogota   = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Bogota' }).format(new Date())
const CURRENT_YEAR  = Number(_nowBogota.slice(0, 4))
const CURRENT_MONTH = Number(_nowBogota.slice(5, 7))

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
  cancelledCount: number
  inProcedureCount: number
  finalizedCount: number
  monthlyLines: { label: string; agendadas: number; asistencias: number; procedimiento: number; finalizados: number }[]
  avgAsistencias: number
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

function computeMetrics(data: RawDashboardData, months: number[], year: number, currentYear: number, currentMonth: number): Metrics {
  const { appointments, yearLeads, doctors } = data
  const monthSet = new Set(months)
  const inPeriod = (ym: string) =>
    Number(ym.slice(0, 4)) === year && monthSet.has(Number(ym.slice(5)))

  // Funnel
  const leadsCount        = yearLeads.filter(l => inPeriod(l.ym)).length
  const citasCount        = appointments.filter(a => inPeriod(a.ym)).length
  const attendedCount     = appointments.filter(a => inPeriod(a.ym) && a.status === 'completed').length
  const cancelledCount    = appointments.filter(a => inPeriod(a.ym) && a.status === 'cancelled').length
  const inProcedureCount  = yearLeads.filter(l => inPeriod(l.ym) && l.status === 'en_tratamiento_medico').length
  const finalizedCount    = yearLeads.filter(l => inPeriod(l.ym) && l.status === 'finalizado').length

  // Monthly lines — always full year, ignoring month filter
  const maxMonth = year === currentYear ? currentMonth : 12
  const allYearMonths = Array.from({ length: maxMonth }, (_, i) => i + 1)
  const monthlyLines = allYearMonths.map(m => {
    const ym_str = `${year}-${pad(m)}`
    return {
      label:         MONTH_LABELS[m - 1],
      agendadas:     appointments.filter(a => a.ym === ym_str).length,
      asistencias:   appointments.filter(a => a.ym === ym_str && a.status === 'completed').length,
      procedimiento: yearLeads.filter(l => l.ym === ym_str && l.status === 'en_tratamiento_medico').length,
      finalizados:   yearLeads.filter(l => l.ym === ym_str && l.status === 'finalizado').length,
    }
  })
  const activeMths = monthlyLines.filter(ml => ml.agendadas > 0)
  const avgAsistencias = activeMths.length > 0
    ? Math.round(activeMths.reduce((s, ml) => s + ml.asistencias, 0) / activeMths.length)
    : 0

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
    if (!inPeriod(a.ym)) return
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
    leadsCount, citasCount, attendedCount, cancelledCount, inProcedureCount, finalizedCount,
    monthlyLines, avgAsistencias, thisWeek, lastWeek, monthAvg, doctorStats,
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

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({
  initialData,
  availableYears,
}: {
  initialData: RawDashboardData
  availableYears: number[]
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
    () => computeMetrics(rawData, selectedMonths, selectedYear, CURRENT_YEAR, CURRENT_MONTH),
    [rawData, selectedMonths, selectedYear]
  )

  const funnelSteps = [
    { label: 'Leads',            count: m.leadsCount,       bg: 'bg-slate-100',  text: 'text-slate-700' },
    { label: 'Citas totales',    count: m.citasCount,       bg: 'bg-violet-50',  text: 'text-violet-700' },
    { label: 'Asistieron',       count: m.attendedCount,    bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { label: 'En procedimiento', count: m.inProcedureCount, bg: 'bg-amber-50',  text: 'text-amber-700' },
    { label: 'Finalizados',      count: m.finalizedCount,   bg: 'bg-blue-50',   text: 'text-blue-700' },
  ]

  const weekMax = Math.max(m.thisWeek, m.lastWeek, m.monthAvg, 1)

  return (
    <div className="space-y-6">

      {/* Header + filtros */}
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

      {/* Bloque 1 — Funnel visual */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {funnelSteps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className={`rounded-2xl ${step.bg} px-6 py-5 text-center min-w-[120px]`}>
                <p className={`text-4xl font-black ${step.text}`}>{step.count}</p>
                <p className="mt-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{step.label}</p>
                {i > 0 && (() => {
                  const prev = funnelSteps[i - 1].count
                  const pct = prev > 0 ? Math.round((step.count / prev) * 100) : null
                  return pct !== null ? (
                    <p className={`mt-1 text-sm font-bold ${pct >= 50 ? 'text-emerald-500' : pct >= 25 ? 'text-amber-500' : 'text-red-400'}`}>
                      {pct}%
                    </p>
                  ) : null
                })()}
              </div>
              {i < funnelSteps.length - 1 && (
                <ArrowRight className="h-5 w-5 text-slate-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1">
          <p className="text-xs text-slate-400">
            Canceladas en el período: <span className="font-semibold text-slate-600">{m.cancelledCount}</span>
            {m.citasCount > 0 && (
              <span className="ml-1 font-semibold text-red-400">
                ({Math.round((m.cancelledCount / m.citasCount) * 100)}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Bloque 2 — Tendencia mensual (ancho completo) */}
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        <h2 className="text-base font-semibold text-slate-900">Tendencia mensual</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-400">Agendadas vs Asistencias · año completo</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={m.monthlyLines} margin={{ top: 20, right: 16, left: -20, bottom: 0 }} barCategoryGap="20%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            {m.avgAsistencias > 0 && (
              <ReferenceLine y={m.avgAsistencias} stroke="#10b981" strokeDasharray="5 5" strokeWidth={1.5}
                label={{ value: `Prom. ${m.avgAsistencias}`, position: 'insideTopLeft', fontSize: 10, fill: '#10b981' }} />
            )}
            <Bar dataKey="agendadas" name="Agendadas" fill="#6366f1" radius={[4,4,0,0]}>
              <LabelList dataKey="agendadas" position="top" style={{ fontSize: 9, fill: '#6366f1', fontWeight: 600 }} />
            </Bar>
            <Bar dataKey="asistencias" name="Asistencias" fill="#10b981" radius={[4,4,0,0]}>
              <LabelList dataKey="asistencias" position="top" style={{ fontSize: 9, fill: '#10b981', fontWeight: 600 }} />
            </Bar>
            <Bar dataKey="procedimiento" name="Procedimiento" fill="#f59e0b" radius={[4,4,0,0]}>
              <LabelList dataKey="procedimiento" position="top" style={{ fontSize: 9, fill: '#f59e0b', fontWeight: 600 }} />
            </Bar>
            <Bar dataKey="finalizados" name="Finalizados" fill="#3b82f6" radius={[4,4,0,0]}>
              <LabelList dataKey="finalizados" position="top" style={{ fontSize: 9, fill: '#3b82f6', fontWeight: 600 }} />
            </Bar>
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
                  <th className="py-2 px-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Paciente / Auto
                    <InfoTooltip text="Paciente: el paciente eligió este médico. Auto: el sistema lo asignó automáticamente. Útil para medir demanda real por médico." />
                  </th>
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
