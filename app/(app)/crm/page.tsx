'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreateLeadModal } from '@/components/crm/create-lead-modal'
import { Plus, Loader2, Search, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Lead {
  id: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  source: string | null
  status: string
  assigned_user_id: string | null
  created_at: string
}

const statusPipeline = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'converted', label: 'Convertido' },
  { value: 'lost', label: 'Perdido' },
]

const sources = [
  { value: 'all', label: 'Todas' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'other', label: 'Otra' },
]

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const supabase = createClient()

  const loadOrganizationContext = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        setError('Error obteniendo usuario')
        return
      }

      if (!user?.id) {
        setError('Usuario no autenticado')
        return
      }

      const { data: currentUser, error: profileError } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError('Error obteniendo organización del usuario')
        return
      }

      setOrganizationId(currentUser?.organization_id ?? null)
    } catch (err) {
      console.error(err)
      setError('Error cargando contexto de CRM')
    }
  }

  const loadLeads = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: leadError } = await supabase
        .from('leads')
        .select('id, contact_name, contact_phone, contact_email, source, status, assigned_user_id, created_at')
        .order('created_at', { ascending: false })

      if (leadError) {
        console.error(leadError)
        setError('Error cargando leads')
        return
      }

      setLeads(data ?? [])
    } catch (err) {
      console.error(err)
      setError('Error cargando leads')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOrganizationContext()
    loadLeads()
  }, [])

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const statusMatch = statusFilter === 'all' || lead.status === statusFilter
        const sourceMatch = sourceFilter === 'all' || lead.source === sourceFilter
        return statusMatch && sourceMatch
      }),
    [leads, statusFilter, sourceFilter]
  )

  const pipelineData = statusPipeline.map((status) => ({
    ...status,
    count: filteredLeads.filter((lead) => lead.status === status.value).length,
  }))

  const createLead = async (payload: {
    full_name: string
    phone: string
    email: string
    source: string
    notes: string
  }) => {
    if (!organizationId) {
      return { success: false, error: 'Organización no encontrada' }
    }

    try {
      const { error } = await supabase.from('leads').insert({
        organization_id: organizationId,
        contact_name: payload.full_name,
        contact_phone: payload.phone,
        contact_email: payload.email,
        source: payload.source,
        notes: payload.notes,
        status: 'new',
      })

      if (error) {
        console.error(error)
        return { success: false, error: error.message }
      }

      await loadLeads()
      return { success: true }
    } catch (err) {
      console.error(err)
      return { success: false, error: 'Error creando lead' }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">CRM</h1>
            <p className="text-slate-600 mt-1">Pipeline de leads y administración básica.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Crear lead manual
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
          {pipelineData.map((stage) => (
            <div key={stage.value} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stage.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{stage.count}</p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <ArrowRight className="h-5 w-5" />
                </span>
              </div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Estado</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Filtrar por estado
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  {statusPipeline.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Filtrar por fuente
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sources.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <p className="text-sm text-slate-600">{filteredLeads.length} leads encontrados</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Fuente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Asignado a</th>
                  <th className="px-4 py-3">Fecha creación</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando leads...
                      </span>
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                      No hay leads que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="rounded-3xl border border-slate-200 bg-slate-50 text-slate-700 shadow-sm">
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-slate-900">{lead.contact_name || 'Sin nombre'}</div>
                        <div className="text-xs text-slate-500">{lead.contact_email || 'Sin email'}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{lead.contact_phone || 'Sin teléfono'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 capitalize">{lead.source || 'Desconocida'}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                          {statusPipeline.find((status) => status.value === lead.status)?.label || lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{lead.assigned_user_id || 'Sin asignar'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{format(new Date(lead.created_at), 'dd MMM yyyy', { locale: es })}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreateLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setIsModalOpen(false)}
        onCreateLead={createLead}
      />

      {error && (
        <div className="fixed bottom-4 right-4 rounded-3xl bg-red-600 px-5 py-3 text-white shadow-lg">
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
