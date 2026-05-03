import { CalendarDays, Users, TrendingUp, Clock } from 'lucide-react'
import { getOrgDashboardMetrics } from './actions'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No show',
}

const SOURCE_LABELS: Record<string, string> = {
  book: 'Agendamiento',
  booking: 'Agendamiento',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  manychat: 'ManyChat',
  manual: 'Manual',
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso))
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota',
  }).format(new Date(iso))
}

function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(iso))
}

function modalityFromNotes(notes: string | null): string {
  if (!notes) return '—'
  if (notes.toLowerCase().includes('virtual')) return 'Virtual'
  if (notes.toLowerCase().includes('presencial')) return 'Presencial'
  return '—'
}

export default async function DashboardPage() {
  const metrics = await getOrgDashboardMetrics()

  if (!metrics) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
        <p className="text-sm text-red-700">Error cargando el dashboard.</p>
      </div>
    )
  }

  const cards = [
    {
      label: 'Citas hoy',
      value: metrics.appointmentsToday,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Citas esta semana',
      value: metrics.appointmentsThisWeek,
      icon: CalendarDays,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Total leads',
      value: metrics.totalLeads,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Total pacientes',
      value: metrics.totalPatients,
      icon: Users,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Panel principal
            </p>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-2 text-slate-600">Resumen de citas y leads de tu organización.</p>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <div className={`${card.bg} rounded-xl p-2`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
              <p className="mt-4 text-4xl font-bold text-slate-900">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Upcoming appointments */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Próximas citas</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Citas confirmadas a partir de ahora
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Fecha
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Hora
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Paciente
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Médico
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Modalidad
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {metrics.upcomingAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    No hay citas próximas.
                  </td>
                </tr>
              ) : (
                metrics.upcomingAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 text-slate-700 capitalize">
                      {formatDate(apt.scheduled_at)}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {formatTime(apt.scheduled_at)}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">
                        {apt.patient_name ?? 'Sin nombre'}
                      </p>
                      {apt.patient_phone && (
                        <p className="text-xs text-slate-400">{apt.patient_phone}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {apt.doctor_name ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {modalityFromNotes(apt.notes)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_COLORS[apt.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {STATUS_LABELS[apt.status] ?? apt.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent leads */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Últimos leads</h2>
          <p className="text-sm text-slate-500 mt-0.5">Los 10 leads más recientes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Nombre
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Teléfono
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Fuente
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {metrics.recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    No hay leads registrados.
                  </td>
                </tr>
              ) : (
                metrics.recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {lead.contact_name ?? 'Sin nombre'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {lead.contact_phone ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {SOURCE_LABELS[lead.source ?? ''] ?? (lead.source || 'Otra')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatDateShort(lead.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
