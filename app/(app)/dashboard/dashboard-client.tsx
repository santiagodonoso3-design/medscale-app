'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { CalendarDays, TrendingUp, TrendingDown, Users, Activity } from 'lucide-react'
import type { DashboardData } from './actions'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`rounded-xl p-2 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-4xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

// ── Custom tooltip for chart ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-blue-600">{payload[0].value} citas</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({ data }: { data: DashboardData }) {
  const { trendVsPrev } = data
  const trendUp = trendVsPrev >= 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Panel principal</p>
        <h1 className="mt-0.5 text-2xl font-bold text-slate-900">Dashboard</h1>
      </div>

      {/* Block 1 — KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Citas este mes"
          value={data.appointmentsThisMonth}
          icon={CalendarDays}
          accent="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Tasa de asistencia"
          value={`${data.attendanceRate}%`}
          sub="completadas / no canceladas"
          icon={Activity}
          accent="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          label="En procedimiento"
          value={data.activeInProcedure}
          sub="leads activos"
          icon={TrendingUp}
          accent="bg-violet-50 text-violet-600"
        />
        <KpiCard
          label="Leads nuevos este mes"
          value={data.newLeadsThisMonth}
          icon={Users}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Block 2 + 3 — Trend + Procedures */}
      <div className="grid gap-4 xl:grid-cols-3">

        {/* Block 2 — Bar chart */}
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Tendencia de agendamientos</h2>
              <p className="text-xs text-slate-400 mt-0.5">Últimos 7 meses · citas no canceladas</p>
            </div>
            <div className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold ${
              trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              {trendUp
                ? <TrendingUp className="h-3.5 w-3.5" />
                : <TrendingDown className="h-3.5 w-3.5" />}
              {trendUp ? '+' : ''}{trendVsPrev}% vs mes anterior
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              <ReferenceLine
                y={data.monthlyAvg}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: `Prom ${data.monthlyAvg}`, position: 'right', fontSize: 10, fill: '#94a3b8' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Block 3 — Procedures */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Procedimientos</h2>
          <div className="space-y-4">
            <div className="rounded-2xl bg-violet-50 px-5 py-4">
              <p className="text-xs text-violet-500 font-medium uppercase tracking-wide">Activos ahora</p>
              <p className="mt-1 text-3xl font-bold text-violet-700">{data.totalInProcedure}</p>
              <p className="text-xs text-violet-400 mt-0.5">leads en procedimiento</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Prom. mensual citas</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{data.avgProcedurePerMonth}</p>
              <p className="text-xs text-slate-400 mt-0.5">últimos 6 meses</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Conversión lead → procedimiento</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{data.leadToProcedureRate}%</p>
              <p className="text-xs text-slate-400 mt-0.5">del total de leads</p>
            </div>
          </div>
        </div>
      </div>

      {/* Block 4 — Por médico */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Por médico</h2>
        {data.doctorStats.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sin datos de citas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Médico','Asignadas','Completadas','No asistió','Canceladas','% Asistencia'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.doctorStats.map(d => (
                  <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
                    <td className="px-4 py-3 text-slate-700">{d.total}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{d.completed}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600">{d.no_show}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{d.cancelled}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${d.attendanceRate >= 80 ? 'bg-emerald-500' : d.attendanceRate >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${d.attendanceRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{d.attendanceRate}%</span>
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
