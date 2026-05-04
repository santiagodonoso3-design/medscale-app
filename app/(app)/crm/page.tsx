'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreateLeadModal } from '@/components/crm/create-lead-modal'
import { Plus, Loader2, Search, X, Save, List, LayoutGrid, ChevronDown } from 'lucide-react'

interface Lead {
  id: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  source: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

interface LeadAppointment {
  id: string
  scheduled_at: string
  status: string
  notes: string | null
  doctor?: { metadata: Record<string, unknown> | null }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_PIPELINE = [
  { value: 'nuevo',            label: 'Nuevo' },
  { value: 'contactado',       label: 'Contactado' },
  { value: 'agendado',         label: 'Agendado' },
  { value: 'en_procedimiento', label: 'En procedimiento' },
  { value: 'finalizado',       label: 'Finalizado' },
  { value: 'perdido',          label: 'Perdido' },
]

const STATUS_COLORS: Record<string, string> = {
  nuevo:            'bg-slate-100 text-slate-700',
  contactado:       'bg-blue-100 text-blue-700',
  agendado:         'bg-amber-100 text-amber-800',
  en_procedimiento: 'bg-violet-100 text-violet-700',
  finalizado:       'bg-emerald-100 text-emerald-800',
  perdido:          'bg-red-100 text-red-700',
}

const STATUS_NORMALIZE: Record<string, string> = {
  new:       'nuevo',
  contacted: 'contactado',
  scheduled: 'agendado',
  converted: 'finalizado',
  lost:      'perdido',
}

const PIPELINE_ACCENT: Record<string, string> = {
  nuevo:            'border-slate-300  bg-slate-50',
  contactado:       'border-blue-300   bg-blue-50',
  agendado:         'border-amber-300  bg-amber-50',
  en_procedimiento: 'border-violet-300 bg-violet-50',
  finalizado:       'border-emerald-300 bg-emerald-50',
  perdido:          'border-red-300    bg-red-50',
}

const KANBAN_HEADER: Record<string, string> = {
  nuevo:            'bg-slate-200/60',
  contactado:       'bg-blue-100',
  agendado:         'bg-amber-100',
  en_procedimiento: 'bg-violet-100',
  finalizado:       'bg-emerald-100',
  perdido:          'bg-red-100',
}

const SOURCE_LABELS: Record<string, string> = {
  book:         'Agendamiento',
  booking:      'Agendamiento',
  manychat:     'ManyChat',
  manychat_n8n: 'ManyChat',
  manual:       'Manual',
}

const SOURCES = [
  { value: 'all',      label: 'Todas las fuentes' },
  { value: 'book',     label: 'Agendamiento' },
  { value: 'manychat', label: 'ManyChat' },
]

const APT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed:  'bg-sky-100 text-sky-800',
  completed:  'bg-emerald-100 text-emerald-800',
  cancelled:  'bg-slate-100 text-slate-500',
  no_show:    'bg-red-100 text-red-700',
}
const APT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  confirmed:  'Confirmada',
  completed:  'Completada',
  cancelled:  'Cancelada',
  no_show:    'No show',
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota',
  }).format(new Date(iso))

const statusLabel = (val: string) =>
  STATUS_PIPELINE.find(s => s.value === val)?.label ?? val

// ── Kanban view ───────────────────────────────────────────────────────────────

function KanbanView({
  leads,
  aptCounts,
  onStatusChange,
  onOpenLead,
}: {
  leads: Lead[]
  aptCounts: Record<string, number>
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>
  onOpenLead: (lead: Lead) => void
}) {
  const [dragLeadId,    setDragLeadId]    = useState<string | null>(null)
  const [dragOverCol,   setDragOverCol]   = useState<string | null>(null)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: '960px' }}>
        {STATUS_PIPELINE.map(stage => {
          const colLeads = leads.filter(l => l.status === stage.value)
          const isOver   = dragOverCol === stage.value

          return (
            <div
              key={stage.value}
              className={[
                'flex flex-1 min-w-[155px] flex-col rounded-2xl border transition',
                isOver
                  ? 'border-blue-400 bg-blue-50 shadow-md'
                  : 'border-slate-200 bg-slate-50/50',
              ].join(' ')}
              onDragOver={e => { e.preventDefault(); setDragOverCol(stage.value) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={async e => {
                e.preventDefault()
                setDragOverCol(null)
                if (dragLeadId && dragLeadId !== leads.find(l => l.id === dragLeadId && l.status === stage.value)?.id) {
                  await onStatusChange(dragLeadId, stage.value)
                }
                setDragLeadId(null)
              }}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between rounded-t-2xl px-3 py-2.5 ${KANBAN_HEADER[stage.value] ?? 'bg-slate-100'}`}>
                <span className="text-xs font-semibold text-slate-700">{stage.label}</span>
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-xs font-bold text-slate-600">
                  {colLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 flex-1 min-h-[80px]">
                {colLeads.map(lead => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragLeadId(lead.id)}
                    onClick={() => onOpenLead(lead)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-slate-300 transition select-none"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {lead.contact_name || 'Sin nombre'}
                    </p>
                    {lead.contact_phone && (
                      <p className="mt-0.5 text-xs text-slate-500">{lead.contact_phone}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 truncate max-w-[90px]">
                        {SOURCE_LABELS[lead.source ?? ''] ?? (lead.source || 'Otra')}
                      </span>
                      {(aptCounts[lead.id] ?? 0) > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 text-xs font-bold text-blue-700">
                          {aptCounts[lead.id]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">{fmtDate(lead.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CrmPage ───────────────────────────────────────────────────────────────────

export default function CrmPage() {
  const [leads,          setLeads]          = useState<Lead[]>([])
  const [isLoading,      setIsLoading]      = useState(true)
  const [isModalOpen,    setIsModalOpen]    = useState(false)
  const [statusFilter,   setStatusFilter]   = useState('all')
  const [sourceFilter,   setSourceFilter]   = useState('all')
  const [search,         setSearch]         = useState('')
  const [error,          setError]          = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [view,           setView]           = useState<'list' | 'kanban'>('list')
  const [aptCounts,      setAptCounts]      = useState<Record<string, number>>({})

  // inline status popover
  const [statusPopover, setStatusPopover] = useState<{
    leadId: string; top: number; left: number
  } | null>(null)

  // lead detail + edit
  const [selectedLead,     setSelectedLead]     = useState<Lead | null>(null)
  const [leadAppointments, setLeadAppointments] = useState<LeadAppointment[]>([])
  const [loadingApts,      setLoadingApts]      = useState(false)
  const [editForm,         setEditForm]         = useState({
    contact_name: '', contact_phone: '', contact_email: '', notes: '', status: '',
  })
  const [savingLead,    setSavingLead]    = useState(false)
  const [saveLeadError, setSaveLeadError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('users').select('organization_id').eq('id', user.id).single()
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
        .select('id, contact_name, contact_phone, contact_email, source, status, notes, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (leadError) { setError('Error cargando leads'); return }

      const normalized = (data ?? []).map(lead => ({
        ...lead,
        status: STATUS_NORMALIZE[lead.status] ?? lead.status,
      }))
      setLeads(normalized)

      // appointment counts per lead
      if (normalized.length > 0) {
        const { data: aptData } = await supabase
          .from('appointments')
          .select('lead_id')
          .in('lead_id', normalized.map(l => l.id))
        const counts: Record<string, number> = {}
        for (const a of (aptData ?? [])) {
          if (a.lead_id) counts[a.lead_id] = (counts[a.lead_id] ?? 0) + 1
        }
        setAptCounts(counts)
      }
    } catch { setError('Error cargando leads') }
    finally { setIsLoading(false) }
  }

  const handleInlineStatusChange = async (leadId: string, newStatus: string) => {
    setStatusPopover(null)
    const now = new Date().toISOString()
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status: newStatus, updated_at: now } : l
    ))
    await supabase.from('leads')
      .update({ status: newStatus, updated_at: now })
      .eq('id', leadId)
  }

  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead)
    setEditForm({
      contact_name:  lead.contact_name  ?? '',
      contact_phone: lead.contact_phone ?? '',
      contact_email: lead.contact_email ?? '',
      notes:         lead.notes         ?? '',
      status:        lead.status,
    })
    setSaveLeadError(null)
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

  const closeDetail = () => { setSelectedLead(null); setSaveLeadError(null) }

  const handleSaveLead = async () => {
    if (!selectedLead) return
    setSavingLead(true)
    setSaveLeadError(null)
    const now = new Date().toISOString()
    const { error } = await supabase.from('leads').update({
      contact_name:  editForm.contact_name.trim()  || null,
      contact_phone: editForm.contact_phone.trim() || null,
      contact_email: editForm.contact_email.trim() || null,
      notes:         editForm.notes.trim()         || null,
      status:        editForm.status,
      updated_at:    now,
    }).eq('id', selectedLead.id)
    if (error) { setSaveLeadError(error.message); setSavingLead(false); return }
    await loadLeads()
    setSelectedLead(prev => prev ? {
      ...prev,
      contact_name:  editForm.contact_name.trim()  || null,
      contact_phone: editForm.contact_phone.trim() || null,
      contact_email: editForm.contact_email.trim() || null,
      notes:         editForm.notes.trim()         || null,
      status:        editForm.status,
      updated_at:    now,
    } : null)
    setSavingLead(false)
  }

  const filteredLeads = useMemo(() =>
    leads.filter(lead => {
      const matchStatus = statusFilter === 'all' || lead.status === statusFilter
      const matchSource = sourceFilter === 'all' ||
        lead.source === sourceFilter ||
        (sourceFilter === 'manychat' && lead.source === 'manychat_n8n')
      const matchSearch = !search ||
        lead.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
        lead.contact_phone?.includes(search) ||
        lead.contact_email?.toLowerCase().includes(search.toLowerCase())
      return matchStatus && matchSource && matchSearch
    }),
    [leads, statusFilter, sourceFilter, search]
  )

  const createLead = async (payload: {
    full_name: string; phone: string; email: string; source: string; notes: string
  }) => {
    if (!organizationId) return { success: false, error: 'Organización no encontrada' }
    const { error } = await supabase.from('leads').insert({
      organization_id: organizationId,
      contact_name:  payload.full_name,
      contact_phone: payload.phone,
      contact_email: payload.email,
      source:  payload.source,
      notes:   payload.notes,
      status:  'nuevo',
    })
    if (error) return { success: false, error: error.message }
    await loadLeads()
    return { success: true }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM / Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Leads desde agendamiento online y ManyChat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === 'kanban' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Crear lead
          </button>
        </div>
      </div>

      {/* Pipeline cards */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STATUS_PIPELINE.map(stage => {
          const count    = leads.filter(l => l.status === stage.value).length
          const isActive = statusFilter === stage.value
          return (
            <button
              key={stage.value}
              onClick={() => setStatusFilter(isActive ? 'all' : stage.value)}
              className={[
                'rounded-2xl border p-4 text-left transition',
                isActive
                  ? (PIPELINE_ACCENT[stage.value] ?? 'border-blue-300 bg-blue-50')
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ].join(' ')}
            >
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="mt-1 text-xs font-medium text-slate-500 leading-tight">{stage.label}</p>
            </button>
          )
        })}
      </div>

      {/* Filters bar */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            {STATUS_PIPELINE.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SOURCES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="shrink-0 text-sm text-slate-500">{filteredLeads.length} leads</p>
        </div>

        {/* ── List view ────────────────────────────────────────────────────── */}
        {view === 'list' && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Teléfono</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fuente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Citas</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Creado</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando leads...
                      </span>
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                      No hay leads con los filtros seleccionados.
                    </td>
                  </tr>
                ) : filteredLeads.map(lead => {
                  const aptCount = aptCounts[lead.id] ?? 0
                  const isPopoverOpen = statusPopover?.leadId === lead.id
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openLeadDetail(lead)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {lead.contact_name || 'Sin nombre'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{lead.contact_phone || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{lead.contact_email || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {SOURCE_LABELS[lead.source ?? ''] ?? (lead.source || 'Otra')}
                        </span>
                      </td>

                      {/* Citas */}
                      <td className="px-5 py-3.5">
                        {aptCount === 0
                          ? <span className="text-xs text-slate-400">—</span>
                          : <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">
                              {aptCount}
                            </span>
                        }
                      </td>

                      {/* Estado inline */}
                      <td
                        className="px-5 py-3.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (isPopoverOpen) {
                              setStatusPopover(null)
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setStatusPopover({ leadId: lead.id, top: rect.bottom + 4, left: rect.left })
                            }
                          }}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 ${STATUS_COLORS[lead.status] ?? 'bg-slate-100 text-slate-600'}`}
                        >
                          {statusLabel(lead.status)}
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      </td>

                      {/* Creado */}
                      <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                        {fmtDate(lead.created_at)}
                      </td>

                      {/* Actualizado */}
                      <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                        {fmtDate(lead.updated_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Kanban view ───────────────────────────────────────────────────── */}
        {view === 'kanban' && (
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando leads...
              </div>
            ) : (
              <KanbanView
                leads={filteredLeads}
                aptCounts={aptCounts}
                onStatusChange={handleInlineStatusChange}
                onOpenLead={openLeadDetail}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Status popover (fixed, avoids overflow-x-auto clipping) ──────── */}
      {statusPopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setStatusPopover(null)}
          />
          <div
            className="fixed z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: statusPopover.top, left: statusPopover.left }}
          >
            {STATUS_PIPELINE.map(s => (
              <button
                key={s.value}
                onClick={() => handleInlineStatusChange(statusPopover.leadId, s.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[s.value]}`}>
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Lead detail + edit modal ─────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDetail} />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">

            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Detalle de lead</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {SOURCE_LABELS[selectedLead.source ?? ''] ?? (selectedLead.source || 'Fuente desconocida')} ·{' '}
                  {fmtDate(selectedLead.created_at)}
                </p>
              </div>
              <button onClick={closeDetail} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</label>
                  <input
                    value={editForm.contact_name}
                    onChange={e => setEditForm(p => ({ ...p, contact_name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Teléfono</label>
                  <input
                    value={editForm.contact_phone}
                    onChange={e => setEditForm(p => ({ ...p, contact_phone: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
                  <input
                    type="email"
                    value={editForm.contact_email}
                    onChange={e => setEditForm(p => ({ ...p, contact_email: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_PIPELINE.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
                  <textarea
                    value={editForm.notes}
                    onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    placeholder="Sin notas..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {saveLeadError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{saveLeadError}</p>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleSaveLead}
                  disabled={savingLead}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {savingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar cambios
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Citas vinculadas
                </p>
                {loadingApts ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando citas...
                  </div>
                ) : leadAppointments.length === 0 ? (
                  <p className="py-2 text-sm text-slate-400">Sin citas registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {leadAppointments.map(apt => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {new Intl.DateTimeFormat('es-CO', {
                              weekday: 'short', day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
                            }).format(new Date(apt.scheduled_at))}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
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
