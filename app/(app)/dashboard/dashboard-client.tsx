'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Users, CalendarDays, Activity, Stethoscope, MessageCircle } from 'lucide-react'
import type { DashboardData, FunnelCard } from './actions'

// ── Status labels/colors ──────────────────────────────────────────────────────

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

// ── Delta badge ───────────────────────────────────────────────────────────────

function Delta({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{value}% vs mes ant.
    </span>
  )
}

// ── Funnel KPI Card ───────────────────────────────────────────────────────────

function FunnelKpiCard({
  label, card, icon: Icon, accent, step,
}: {
  label: string
  card: FunnelCard | number
  icon: React.ElementType
  accent: string
  step: number
}) {
  const value = typeof card === 'number' ? card : card.value
  const d     = typeof card === 'number' ? null  : card.delta
  return (
    <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
      <span className="absolute top-3 right-3 text-[10px] font-bold text-slate-200 select-none">#{step}</span>
      <div className={`mb-3 inline-flex rounded-xl p-2 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
      {d !== null && (
        <div className="mt-2">
          <Delta value={d} />
        </div>
      )}
    </div>
  )
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-blue-600">{payload[0].value} citas</p>
    </div>
  )
}

// ── Time formatter ────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Panel principal</p>
        <h1 className="mt-0.5 text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Funnel Lead → Conversación → Cita → Asistencia → Procedimiento</p>
      </div>

      {/* Block 1 — Funnel KPIs */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <FunnelKpiCard step={1} label="Leads este mes"     card={data.leadsThisMonth}    icon={Users}          accent="bg-slate-100 text-slate-500" />
        <FunnelKpiCard step={2} label="En conversación"    card={data.inConversation}    icon={MessageCircle}  accent="bg-blue-50 text-blue-500" />
        <FunnelKpiCard step={3} label="Citas agendadas"    card={data.citasThisMonth}    icon={CalendarDays}   accent="bg-violet-50 text-violet-500" />
        <FunnelKpiCard step={4} label="Asistieron"         card={data.attendedThisMonth} icon={Activity}       accent="bg-emerald-50 text-emerald-600" />
        <FunnelKpiCard step={5} label="En procedimiento"   card={data.inProcedure}       icon={Stethoscope}    accent="bg-amber-50 text-amber-600" />
      </div>

      {/* Block 2 — Citas de hoy */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Citas de hoy
          {data.todayAppointments.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">
              {data.todayAppointments.length}
            </span>
          )}
        </h2>
        {data.todayAppointments.length === 0 ? (
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
                {data.todayAppointments.map(apt => (
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

      {/* Block 3 — Chart + doctor table side by side */}
      <div className="grid gap-4 xl:grid-cols-3">

        {/* Chart */}
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Agendamientos por mes</h2>
              <p className="mt-0.5 text-xs text-slate-400">Últimos 6 meses · citas no canceladas</p>
            </div>
            {data.trendVsPrev !== null && (
              <div className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                data.trendVsPrev >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}>
                {data.trendVsPrev >= 0
                  ? <TrendingUp className="h-3.5 w-3.5" />
                  : <TrendingDown className="h-3.5 w-3.5" />}
                {data.trendVsPrev >= 0 ? '+' : ''}{data.trendVsPrev}% vs mes anterior
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 40, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              {data.monthlyAvg > 0 && (
                <ReferenceLine
                  y={data.monthlyAvg}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: `Prom ${data.monthlyAvg}`, position: 'right', fontSize: 10, fill: '#94a3b8' }}
                />
              )}
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Doctor table */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Por médico</h2>
          {data.doctorStats.length === 0 ? (
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
                {data.doctorStats.map(d => (
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
