import { getDashboardMetrics } from './actions'
import { BarChart3, Building2, Users, FileText, Calendar } from 'lucide-react'
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

  const metricCards = [
    {
      label: 'Organizaciones Activas',
      value: metrics.totalOrganizations,
      icon: Building2,
      color: 'blue',
    },
    {
      label: 'Usuarios en el Sistema',
      value: metrics.totalUsers,
      icon: Users,
      color: 'green',
    },
    {
      label: 'Leads Registrados',
      value: metrics.totalLeads,
      icon: FileText,
      color: 'purple',
    },
    {
      label: 'Citas Agendadas',
      value: metrics.totalAppointments,
      icon: Calendar,
      color: 'amber',
    },
  ]

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-100',
    green: 'bg-green-50 text-green-700 border-green-200 ring-green-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100',
  }

  const iconColorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600',
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">Resumen general del sistema Medscale AI</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metricCards.map((card) => {
          const Icon = card.icon
          const colorClass = colorClasses[card.color as keyof typeof colorClasses]
          const iconColorClass = iconColorClasses[card.color as keyof typeof iconColorClasses]

          return (
            <div
              key={card.label}
              className={`rounded-lg border p-6 ${colorClass} ring-1`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-75">{card.label}</p>
                  <p className="text-3xl font-bold mt-2">{card.value}</p>
                </div>
                <Icon className={`h-10 w-10 opacity-20 ${iconColorClass}`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Organizations */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Organizaciones Recientes</h2>
          <p className="text-sm text-slate-600 mt-1">Últimas organizaciones registradas en el sistema</p>
        </div>

        {metrics.recentOrganizations.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No hay organizaciones registradas aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Nombre</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Slug</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Plan</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Usuarios</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Fecha Creación</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentOrganizations.map((org) => (
                  <tr key={org.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{org.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <code className="bg-slate-100 px-2 py-1 rounded text-xs">{org.slug}</code>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {org.plan || 'starter'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          org.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {org.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{org.user_count || 0}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {format(new Date(org.created_at), 'dd MMM yyyy', { locale: es })}
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
