import { getDashboardMetrics } from './actions'
import { Building2, Users, DollarSign, Calendar, TrendingUp, TrendingDown, Activity, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function AdminDashboard() {
  const metrics = await getDashboardMetrics()

  if (!metrics) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">Error cargando métricas del dashboard</p>
        </div>
      </div>
    )
  }

  const appointmentDelta = metrics.appointmentsLastMonth > 0
    ? Math.round(((metrics.appointmentsThisMonth - metrics.appointmentsLastMonth) / metrics.appointmentsLastMonth) * 100)
    : metrics.appointmentsThisMonth > 0 ? 100 : 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Dashboard</h1>
        <p className="text-slate-500 text-sm">Resumen operativo — {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* MRR */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">MRR</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">US${metrics.mrr.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{metrics.activeOrganizations} org{metrics.activeOrganizations !== 1 ? 's' : ''} activa{metrics.activeOrganizations !== 1 ? 's' : ''}</p>
        </div>

        {/* Orgs */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Organizaciones</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{metrics.totalOrganizations}</p>
          <p className="text-xs text-slate-500 mt-1">{metrics.activeOrganizations} activas</p>
        </div>

        {/* Citas este mes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-violet-100 rounded-lg">
              <Calendar className="h-4 w-4 text-violet-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Citas (mes)</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{metrics.appointmentsThisMonth}</p>
          <div className="flex items-center gap-1 mt-1">
            {appointmentDelta >= 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={`text-xs font-medium ${appointmentDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {appointmentDelta >= 0 ? '+' : ''}{appointmentDelta}% vs mes anterior
            </span>
          </div>
        </div>

        {/* Leads totales */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-amber-100 rounded-lg">
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Leads totales</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{metrics.totalLeads.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{metrics.totalUsers} usuarios</p>
        </div>
      </div>

      {/* Org Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Uso por organización</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Organización</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Médicos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Leads</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Citas/mes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Δ vs anterior</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.organizations.map((org) => {
                const delta = org.appointments_last_month > 0
                  ? Math.round(((org.appointments_this_month - org.appointments_last_month) / org.appointments_last_month) * 100)
                  : org.appointments_this_month > 0 ? 100 : 0

                return (
                  <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{org.name}</p>
                        <p className="text-xs text-slate-400">{org.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                        org.plan === 'free'    ? 'bg-slate-100 text-slate-600' :
                        org.plan === 'starter' ? 'bg-blue-50 text-blue-700' :
                        org.plan === 'growth'  ? 'bg-emerald-50 text-emerald-700' :
                        org.plan === 'scale'   ? 'bg-violet-50 text-violet-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-medium text-slate-900">
                        {org.monthly_revenue > 0 ? `US$${org.monthly_revenue}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm text-slate-600">{org.doctor_count}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-slate-600">{org.lead_count.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium text-slate-900">{org.appointments_this_month}</td>
                    <td className="px-4 py-3.5 text-right">
                      {org.appointments_this_month === 0 && org.appointments_last_month === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {delta >= 0 ? '+' : ''}{delta}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className={`h-2 w-2 rounded-full ${org.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
