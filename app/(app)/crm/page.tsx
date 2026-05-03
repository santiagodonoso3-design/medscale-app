'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreateLeadModal } from '@/components/crm/create-lead-modal'
import { Plus, Loader2, Search, X } from 'lucide-react'

interface Lead {
  id: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  source: string | null
  status: string
  notes: string | null
  created_at: string
}

interface LeadAppointment {
  id: string
  scheduled_at: string
  status: string
  notes: string | null
  doctor?: { metadata: Record<string, unknown> | null }[]
}

const STATUS_PIPELINE = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'converted', label: 'Convertido' },
  { value: 'lost', label: 'Perdido' },
]

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-violet-100 text-violet-700',
  scheduled: 'bg-amber-100 text-amber-800',
  converted: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-700',
}

const APT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-red-100 text-red-700',
}

const APT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No show',
}

const SOURCES = [
  { value: 'all', label: 'Todas las fuentes' },
  { value: 'book', label: 'Agendamiento online' },
  { value: 'manychat', label: 'ManyChat (n8n)' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Otra' },
]

const SOURCE_LABELS: Record<string, string> = {
  book: 'Agendamiento',
  booking: 'Agendamiento',
  manychat: 'ManyChat',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  manual: 'Manual',
}

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  // Lead detail modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadAppointments, setLeadAppointments] = useState<LeadAppointment[]>([])
  const [loadingApts, setLoadingApts] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      setOrganizationId(profile?.organization_id ?? null)
      await loadLeads()
    }
    init()
  }, [])

  const loadLeads = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: leadError } = await supabase
        .from('leads')
        .select('id, contact_name, contact_phone, contact_email, source, status, notes, created_at')
        .order('created_at', { ascending: false })
      if (leadError) { setError('Error cargando leads'); return }
      setLeads(data ?? [])
    } catch {
      setError('Error cargando leads')
    } finally {
      setIsLoading(false)
    }
  }

  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead)
    setLeadAppointments([])
    setLoadingApts(true)
    const { data } = await supabase
      .from('appointments')
      .select('id, scheduled_at, status, notes, doctor:doctor_id(metadata)')
      .eq('lead_id', lead.id)
      .order('scheduled_at', { ascending: false })
    setLeadAppointments((data ?? []) as LeadAppointment[])
    setLoadingApts(false)
  }

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const matchStatus = statusFilter === 'all' || lead.status === statusFilter
        const matchSource = sourceFilter === 'all' || lead.source === sourceFilter
        const matchSearch =
          !search ||
          lead.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
          lead.contact_phone?.includes(search) ||
          lead.contact_email?.toLowerCase().includes(search.toLowerCase())
        return matchStatus && matchSource && matchSearch
      }),
    [leads, statusFilter, sourceFilter, search]
  )

  const createLead = async (payload: {
    full_name: string
    phone: string
    email: string
    source: string
    notes: string
  }) => {
    if (!organizationId) return { success: false, error: 'Organización no encontrada' }
    const { error } = await supabase.from('leads').insert({
      organization_id: organizationId,
      contact_name: payload.full_name,
      contact_phone: payload.phone,
      contact_email: payload.email,
      source: payload.source,
      notes: payload.notes,
      status: 'new',
    })
    if (error) return { success: false, error: error.message }
    await loadLeads()
    return { success: true }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">CRM / Leads</h1>
          <p className="text-slate-600 mt-1">
            Leads captados desde agendamiento online, ManyChat y otras fuentes.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Crear lead manual
        </button>
      </div>

      {/* Pipeline counts */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STATUS_PIPELINE.map((stage) => {
          const count = leads.filter((l) => l.status === stage.value).length
          return (
            <button
              key={stage.value}
              onClick={() => setStatusFilter(stage.value === statusFilter ? 'all' : stage.value)}
              className={`rounded-2xl border p-4 text-left transition ${
                statusFilter === stage.value
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{stage.label}</p>
            </button>
          )
        })}
      </div>

      {/* Filters + table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            {STATUS_PIPELINE.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-sm text-slate-500 whitespace-nowrap">
            {filteredLeads.length} leads
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Teléfono</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Email</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fuente</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando leads...
                    </span>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                    No hay leads con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => openLeadDetail(lead)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {lead.contact_name || 'Sin nombre'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{lead.contact_phone || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{lead.contact_email || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {SOURCE_LABELS[lead.source ?? ''] ?? (lead.source || 'Otra')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-xs">
                      {new Intl.DateTimeFormat('es-CO', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'America/Bogota',
                      }).format(new Date(lead.created_at))}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[lead.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_PIPELINE.find((s) => s.value === lead.status)?.label ?? lead.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead detail modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedLead.contact_name || 'Sin nombre'}
                </h2>
                <p className="text-sm text-slate-500">{selectedLead.contact_phone || '—'}</p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {/* Lead details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Email</p>
                  <p className="text-slate-800">{selectedLead.contact_email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Fuente</p>
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {SOURCE_LABELS[selectedLead.source ?? ''] ?? (selectedLead.source || 'Otra')}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Estado</p>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[selectedLead.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_PIPELINE.find((s) => s.value === selectedLead.status)?.label ?? selectedLead.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Registrado</p>
                  <p className="text-slate-800">
                    {new Intl.DateTimeFormat('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'America/Bogota',
                    }).format(new Date(selectedLead.created_at))}
                  </p>
                </div>
                {selectedLead.notes && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Notas</p>
                    <p className="text-slate-700 text-xs whitespace-pre-wrap">{selectedLead.notes}</p>
                  </div>
                )}
              </div>

              {/* Appointments */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Citas vinculadas
                </p>
                {loadingApts ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando citas...
                  </div>
                ) : leadAppointments.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">Sin citas registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {leadAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {new Intl.DateTimeFormat('es-CO', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'America/Bogota',
                            }).format(new Date(apt.scheduled_at))}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {(apt.doctor?.[0]?.metadata?.name as string) || 'Médico sin asignar'}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${APT_STATUS_COLORS[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {APT_STATUS_LABELS[apt.status] ?? apt.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { setIsModalOpen(false); loadLeads() }}
        onCreateLead={createLead}
      />

      {error && (
        <div className="fixed bottom-4 right-4 rounded-2xl bg-red-600 px-5 py-3 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}
