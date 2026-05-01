import { BarChart3, CalendarDays, MessageSquare, Sparkles } from 'lucide-react'
import { getOrgDashboardMetrics } from './actions'

export default async function DashboardPage() {
  const metrics = await getOrgDashboardMetrics()

  if (!metrics) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
        <p className="text-sm text-red-700">Error cargando métricas del dashboard de la clínica.</p>
      </div>
    )
  }

  const sourceStats = [
    { label: 'WhatsApp', value: metrics.leadsBySource.whatsapp, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Instagram', value: metrics.leadsBySource.instagram, color: 'bg-fuchsia-50 text-fuchsia-700' },
    { label: 'Facebook', value: metrics.leadsBySource.facebook, color: 'bg-sky-50 text-sky-700' },
  ]

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Bienvenido</p>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard de la clínica</h1>
            <p className="mt-2 text-slate-600">Resumen de leads y citas para tu organización.</p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-3xl bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Panel del cliente de la clínica
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <MessageSquare className="h-5 w-5" />
            <p className="text-sm font-semibold">Leads este mes</p>
          </div>
          <p className="mt-6 text-4xl font-bold text-slate-900">{metrics.totalLeadsThisMonth}</p>
          <p className="mt-2 text-sm text-slate-500">Nuevos leads captados en el mes actual.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <CalendarDays className="h-5 w-5" />
            <p className="text-sm font-semibold">Citas agendadas</p>
          </div>
          <p className="mt-6 text-4xl font-bold text-slate-900">{metrics.totalAppointments}</p>
          <p className="mt-2 text-sm text-slate-500">Total de citas registradas en la organización.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <BarChart3 className="h-5 w-5" />
            <p className="text-sm font-semibold">Leads por fuente</p>
          </div>
          <div className="mt-6 space-y-3">
            {sourceStats.map((source) => (
              <div key={source.label} className="flex items-center justify-between gap-3 rounded-3xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{source.label}</p>
                  <p className="text-xs text-slate-500">Leads recibidos</p>
                </div>
                <span className={`${source.color} rounded-full px-3 py-1 text-sm font-semibold`}>{source.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <CalendarDays className="h-5 w-5" />
            <p className="text-sm font-semibold">Citas de hoy</p>
          </div>
          <p className="mt-6 text-4xl font-bold text-slate-900">{metrics.appointmentsToday}</p>
          <p className="mt-2 text-sm text-slate-500">Agendadas para hoy en tu organización.</p>
        </div>
      </div>
    </div>
  )
}
