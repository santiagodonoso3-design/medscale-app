'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreateLeadModal } from '@/components/crm/create-lead-modal'
import { BookAppointmentModal } from '@/components/crm/book-appointment-modal'
import {
  Plus, Loader2, Search, X, Save, List, LayoutGrid,
  ChevronDown, CalendarPlus, ChevronUp, ChevronsUpDown, Send,
  FileDown, Upload, Trash2,
} from 'lucide-react'
import { ImportLeadsModal, downloadLeadTemplate } from '@/components/crm/import-leads-modal'
import { deleteLeads } from '@/app/(app)/crm/actions/deleteLeads'
import { bulkUpdateLeadStatus, bulkUpdateLeadSource } from '@/app/(app)/crm/actions/bulkLeadActions'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  contact_name: string | null
  contact_last_name: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_cedula: string | null
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

interface LeadComment {
  id: string
  comment: string
  created_at: string
  user_id: string
  author?: { first_name: string | null; last_name: string | null }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_PIPELINE = [
  { value: 'contactado',               label: 'Contactado' },
  { value: 'cita_valoracion_agendada', label: 'Cita de valoración agendada' },
  { value: 'asistio_cita',             label: 'Asistió a cita' },
  { value: 'cancelo_cita',             label: 'Canceló cita' },
  { value: 'en_tratamiento_medico',    label: 'En tratamiento médico' },
  { value: 'finalizado',               label: 'Finalizado' },
]

const STATUS_ORDER: Record<string, number> = Object.fromEntries(
  STATUS_PIPELINE.map((s, i) => [s.value, i])
)

const STATUS_COLORS: Record<string, string> = {
  contactado:               'bg-blue-100 text-blue-700',
  cita_valoracion_agendada: 'bg-purple-100 text-purple-700',
  asistio_cita:             'bg-emerald-100 text-emerald-700',
  cancelo_cita:             'bg-red-100 text-red-700',
  en_tratamiento_medico:    'bg-orange-100 text-orange-700',
  finalizado:               'bg-slate-100 text-slate-600',
}

// Normalize legacy DB values (English pre-migration + Spanish pre-008 migration)
const STATUS_NORMALIZE: Record<string, string> = {
  new:              'contactado',
  contacted:        'contactado',
  scheduled:        'cita_valoracion_agendada',
  in_procedure:     'en_tratamiento_medico',
  converted:        'finalizado',
  lost:             'cancelo_cita',
  nuevo:            'contactado',
  agendado:         'cita_valoracion_agendada',
  en_procedimiento: 'en_tratamiento_medico',
  perdido:          'cancelo_cita',
}

const PIPELINE_ACCENT: Record<string, string> = {
  contactado:               'border-blue-300   bg-blue-50',
  cita_valoracion_agendada: 'border-purple-300 bg-purple-50',
  asistio_cita:             'border-emerald-300 bg-emerald-50',
  cancelo_cita:             'border-red-300    bg-red-50',
  en_tratamiento_medico:    'border-orange-300 bg-orange-50',
  finalizado:               'border-slate-300  bg-slate-50',
}

const KANBAN_HEADER: Record<string, string> = {
  contactado:               'bg-blue-100',
  cita_valoracion_agendada: 'bg-purple-100',
  asistio_cita:             'bg-emerald-100',
  cancelo_cita:             'bg-red-100',
  en_tratamiento_medico:    'bg-orange-100',
  finalizado:               'bg-slate-200/60',
}

const SOURCE_LABELS: Record<string, string> = {
  instagram:    'Instagram',
  whatsapp:     'WhatsApp',
  facebook:     'Facebook',
  web:          'Página web',
  book:         'Agendamiento online',
  referido:     'Referido',
  manual:       'Manual',
  booking:      'Agendamiento online',
  manychat:     'WhatsApp',
  manychat_n8n: 'WhatsApp',
}

const SOURCE_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'web',       label: 'Página web' },
  { value: 'book',      label: 'Agendamiento online' },
  { value: 'referido',  label: 'Referido' },
  { value: 'manual',    label: 'Manual' },
]

const SOURCES = [{ value: 'all', label: 'Todas las fuentes' }, ...SOURCE_OPTIONS]

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

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  }).format(new Date(iso))

const fmtTimeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `hace ${hrs}h`
  return fmtDate(iso)
}

const statusLabel = (val: string) =>
  STATUS_PIPELINE.find(s => s.value === val)?.label ?? val

type SortField = 'contact_name' | 'created_at' | 'updated_at' | 'status'
type SortDir   = 'asc' | 'desc'
type Popover   = { leadId: string; top: number; left: number }

// ── Sort header component ─────────────────────────────────────────────────────

function SortTh({
  field, label, sortField, sortDir, onSort, className = '',
}: {
  field: SortField; label: string
  sortField: SortField | null; sortDir: SortDir
  onSort: (f: SortField) => void; className?: string
}) {
  const active = sortField === field
  return (
    <th
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 transition ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (sortDir === 'asc'
              ? <ChevronUp   className="h-3 w-3 text-blue-500" />
              : <ChevronDown className="h-3 w-3 text-blue-500" />)
          : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  )
}

// ── Kanban view ───────────────────────────────────────────────────────────────

function KanbanView({
  leads, aptCounts, onStatusChange, onOpenLead,
}: {
  leads: Lead[]
  aptCounts: Record<string, number>
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>
  onOpenLead: (lead: Lead) => void
}) {
  const [dragLeadId,  setDragLeadId]  = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: '960px' }}>
        {STATUS_PIPELINE.map(stage => {
          const colLeads = leads.filter(l => l.status === stage.value)
          const isOver   = dragOverCol === stage.value
          return (
            <div key={stage.value}
              className={['flex flex-1 min-w-[155px] flex-col rounded-2xl border transition',
                isOver ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-slate-200 bg-slate-50/50',
              ].join(' ')}
              onDragOver={e => { e.preventDefault(); setDragOverCol(stage.value) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={async e => {
                e.preventDefault(); setDragOverCol(null)
                if (dragLeadId) await onStatusChange(dragLeadId, stage.value)
                setDragLeadId(null)
              }}
            >
              <div className={`flex items-center justify-between rounded-t-2xl px-3 py-2.5 ${KANBAN_HEADER[stage.value] ?? 'bg-slate-100'}`}>
                <span className="text-xs font-semibold text-slate-700">{stage.label}</span>
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-xs font-bold text-slate-600">
                  {colLeads.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-2 flex-1 min-h-[80px]">
                {colLeads.map(lead => (
                  <div key={lead.id} draggable
                    onDragStart={() => setDragLeadId(lead.id)}
                    onClick={() => onOpenLead(lead)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-slate-300 transition select-none"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">{[lead.contact_name, lead.contact_last_name].filter(Boolean).join(' ') || 'Sin nombre'}</p>
                    {lead.contact_phone && <p className="mt-0.5 text-xs text-slate-500">{lead.contact_phone}</p>}
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

  // sorting
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')

  // popovers
  const [statusPopover, setStatusPopover] = useState<Popover | null>(null)
  const [sourcePopover, setSourcePopover] = useState<Popover | null>(null)

  // lead detail
  const [selectedLead,     setSelectedLead]     = useState<Lead | null>(null)
  const [leadAppointments, setLeadAppointments] = useState<LeadAppointment[]>([])
  const [loadingApts,      setLoadingApts]      = useState(false)
  const [editForm,         setEditForm]         = useState({
    contact_name: '', contact_last_name: '', contact_phone: '', contact_email: '',
    contact_cedula: '', notes: '', status: '', source: '',
  })
  const [savingLead,    setSavingLead]    = useState(false)
  const [saveLeadError, setSaveLeadError] = useState<string | null>(null)
  const [successToast,    setSuccessToast]    = useState<string | null>(null)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // delete / bulk
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const [bulkWorking,   setBulkWorking]   = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)

  // comments
  const [leadComments,    setLeadComments]    = useState<LeadComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment,      setNewComment]      = useState('')
  const [savingComment,   setSavingComment]   = useState(false)
  const [currentUserId,   setCurrentUserId]   = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: profile } = await supabase
        .from('users').select('organization_id').eq('id', user.id).single()
      const orgId = profile?.organization_id ?? null
      setOrganizationId(orgId)
      await loadLeads()
    }
    init()
  }, [])

  const [autoOpenLeadId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const url = new URL(window.location.href)
    return url.searchParams.get('lead')
  })

  useEffect(() => {
    if (autoOpenLeadId && leads.length > 0) {
      const found = leads.find(l => l.id === autoOpenLeadId)
      if (found) openLeadDetail(found)
    }
  }, [leads, autoOpenLeadId])

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadLeads = async () => {
    setIsLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('leads')
        .select('id, contact_name, contact_last_name, contact_phone, contact_email, contact_cedula, source, status, notes, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (err) { setError('Error cargando leads'); return }
      const normalized = (data ?? []).map(l => ({ ...l, status: STATUS_NORMALIZE[l.status] ?? l.status }))
      setLeads(normalized)
      if (normalized.length > 0) {
        const { data: aptData } = await supabase.from('appointments').select('lead_id')
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

  const loadComments = async (leadId: string) => {
    setLoadingComments(true)
    const { data } = await supabase
      .from('lead_comments')
      .select('id, comment, created_at, user_id, author:user_id(first_name, last_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
    setLeadComments((data ?? []) as LeadComment[])
    setLoadingComments(false)
  }

  // ── Inline changers ──────────────────────────────────────────────────────────

  const handleInlineStatusChange = async (leadId: string, newStatus: string) => {
    setStatusPopover(null)
    const now = new Date().toISOString()
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus, updated_at: now } : l))
    await supabase.from('leads').update({ status: newStatus, updated_at: now }).eq('id', leadId)
  }

  const handleInlineSourceChange = async (leadId: string, newSource: string) => {
    setSourcePopover(null)
    const now = new Date().toISOString()
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, source: newSource, updated_at: now } : l))
    await supabase.from('leads').update({ source: newSource, updated_at: now }).eq('id', leadId)
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async (ids: string[]) => {
    setDeleting(true)
    const result = await deleteLeads(ids)
    setDeleting(false)
    setDeleteConfirm(null)
    if (result.error) { setError(result.error); return }
    setLeads(prev => prev.filter(l => !ids.includes(l.id)))
    setSelectedIds(new Set())
    if (selectedLead && ids.includes(selectedLead.id)) closeDetail()
  }

  const handleBulkStatus = async (status: string) => {
    const ids = [...selectedIds]
    setBulkWorking(true)
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, status } : l))
    setSelectedIds(new Set())
    const result = await bulkUpdateLeadStatus(ids, status)
    setBulkWorking(false)
    if (result.error) { setError(result.error); await loadLeads(); return }
    const label = STATUS_PIPELINE.find(s => s.value === status)?.label ?? status
    setSuccessToast(`Estado "${label}" aplicado a ${ids.length} lead${ids.length !== 1 ? 's' : ''}`)
    setTimeout(() => setSuccessToast(null), 3500)
  }

  const handleBulkSource = async (source: string) => {
    const ids = [...selectedIds]
    setBulkWorking(true)
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, source } : l))
    setSelectedIds(new Set())
    const result = await bulkUpdateLeadSource(ids, source)
    setBulkWorking(false)
    if (result.error) { setError(result.error); await loadLeads(); return }
    const label = SOURCE_OPTIONS.find(s => s.value === source)?.label ?? source
    setSuccessToast(`Fuente "${label}" aplicada a ${ids.length} lead${ids.length !== 1 ? 's' : ''}`)
    setTimeout(() => setSuccessToast(null), 3500)
  }


  // ── Lead detail ──────────────────────────────────────────────────────────────

  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead)
    setEditForm({
      contact_name:      lead.contact_name      ?? '',
      contact_last_name: lead.contact_last_name ?? '',
      contact_phone:     lead.contact_phone     ?? '',
      contact_email:     lead.contact_email     ?? '',
      contact_cedula:    lead.contact_cedula    ?? '',
      notes:             lead.notes             ?? '',
      status:            lead.status,
      source:            lead.source            ?? '',
    })
    setSaveLeadError(null); setNewComment('')
    setLeadAppointments([]); setLoadingApts(true)
    const { data } = await supabase
      .from('appointments')
      .select('id, scheduled_at, status, notes, doctor:doctor_id(metadata)')
      .eq('lead_id', lead.id).order('scheduled_at', { ascending: false })
    setLeadAppointments((data ?? []) as LeadAppointment[])
    setLoadingApts(false)
    loadComments(lead.id)
  }

  const closeDetail = () => { setSelectedLead(null); setSaveLeadError(null) }

  const handleSaveLead = async () => {
    if (!selectedLead) return
    setSavingLead(true); setSaveLeadError(null)
    const now = new Date().toISOString()
    const { error } = await supabase.from('leads').update({
      contact_name:      editForm.contact_name.trim()      || null,
      contact_last_name: editForm.contact_last_name.trim() || null,
      contact_phone:     editForm.contact_phone.trim()     || null,
      contact_email:     editForm.contact_email.trim()     || null,
      contact_cedula:    editForm.contact_cedula.trim()    || null,
      notes:             editForm.notes.trim()             || null,
      status:            editForm.status,
      source:            editForm.source                   || null,
      updated_at:        now,
    }).eq('id', selectedLead.id)
    if (error) { setSaveLeadError(error.message); setSavingLead(false); return }
    await loadLeads()
    setSavingLead(false)
    closeDetail()
    setSuccessToast('Lead actualizado')
    setTimeout(() => setSuccessToast(null), 3000)
  }

  const handleSaveComment = async () => {
    if (!selectedLead || !currentUserId || !newComment.trim()) return
    setSavingComment(true)
    const { error } = await supabase.from('lead_comments').insert({
      lead_id: selectedLead.id,
      user_id: currentUserId,
      comment: newComment.trim(),
    })
    if (!error) { setNewComment(''); loadComments(selectedLead.id) }
    setSavingComment(false)
  }

  // ── Filtered + sorted leads ──────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    const filtered = leads.filter(lead => {
      const matchStatus = statusFilter === 'all' || lead.status === statusFilter
      const matchSource = sourceFilter === 'all' || lead.source === sourceFilter
      const q = search.toLowerCase()
      const matchSearch = !search ||
        lead.contact_name?.toLowerCase().includes(q) ||
        lead.contact_last_name?.toLowerCase().includes(q) ||
        lead.contact_phone?.includes(search) ||
        lead.contact_email?.toLowerCase().includes(q) ||
        lead.contact_cedula?.includes(search)
      return matchStatus && matchSource && matchSearch
    })

    if (!sortField) return filtered

    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'contact_name') {
        cmp = (a.contact_name ?? '').localeCompare(b.contact_name ?? '', 'es')
      } else if (sortField === 'status') {
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      } else {
        cmp = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, statusFilter, sourceFilter, search, sortField, sortDir])

  // Keep select-all checkbox indeterminate when only some rows are selected
  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    const some = filteredLeads.some(l => selectedIds.has(l.id))
    const all  = filteredLeads.length > 0 && filteredLeads.every(l => selectedIds.has(l.id))
    el.indeterminate = some && !all
  }, [selectedIds, filteredLeads])

  const createLead = async (payload: {
    first_name: string; last_name: string; phone: string; email: string; source: string; notes: string
  }) => {
    if (!organizationId) return { success: false, error: 'Organización no encontrada' }
    const { error } = await supabase.from('leads').insert({
      organization_id: organizationId,
      contact_name: payload.first_name, contact_last_name: payload.last_name || null,
      contact_phone: payload.phone, contact_email: payload.email,
      source: payload.source, notes: payload.notes, status: 'contactado',
    })
    if (error) return { success: false, error: error.message }
    await loadLeads(); return { success: true }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const openPopover = (
    e: React.MouseEvent,
    setter: (v: Popover) => void,
    currentId: string | null | undefined,
    leadId: string,
    closeSetter: () => void,
  ) => {
    e.stopPropagation()
    if (currentId === leadId) { closeSetter(); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setter({ leadId, top: rect.bottom + 4, left: rect.left })
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM / Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">Leads desde agendamiento online y redes sociales.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              <List className="h-4 w-4" /> Lista
            </button>
            <button onClick={() => setView('kanban')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === 'kanban' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              <LayoutGrid className="h-4 w-4" /> Kanban
            </button>
          </div>
          <button
            onClick={downloadLeadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
          >
            <FileDown className="h-4 w-4" /> Template
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
          >
            <Upload className="h-4 w-4" /> Importar
          </button>
          <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition">
            <Plus className="h-4 w-4" /> Crear lead
          </button>
        </div>
      </div>

      {/* Pipeline */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STATUS_PIPELINE.map(stage => {
          const count = leads.filter(l => l.status === stage.value).length
          const isActive = statusFilter === stage.value
          return (
            <button key={stage.value} onClick={() => setStatusFilter(isActive ? 'all' : stage.value)}
              className={['rounded-2xl border p-4 text-left transition', isActive ? (PIPELINE_ACCENT[stage.value] ?? 'border-blue-300 bg-blue-50') : 'border-slate-200 bg-white hover:bg-slate-50'].join(' ')}>
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="mt-1 text-xs font-medium text-slate-500 leading-tight">{stage.label}</p>
            </button>
          )
        })}
      </div>

      {/* Table card */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Todos los estados</option>
            {STATUS_PIPELINE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, teléfono, cédula o email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <p className="shrink-0 text-sm text-slate-500">{filteredLeads.length} leads</p>
        </div>

        {/* Bulk-action bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-blue-50 px-5 py-2.5">
            <span className="shrink-0 text-sm font-medium text-blue-700">
              {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>

            {/* Cambiar estado */}
            <select
              disabled={bulkWorking}
              value=""
              onChange={e => { if (e.target.value) handleBulkStatus(e.target.value) }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none disabled:opacity-50"
            >
              <option value="" disabled>Cambiar estado</option>
              {STATUS_PIPELINE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* Cambiar fuente */}
            <select
              disabled={bulkWorking}
              value=""
              onChange={e => { if (e.target.value) handleBulkSource(e.target.value) }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none disabled:opacity-50"
            >
              <option value="" disabled>Cambiar fuente</option>
              {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* Eliminar */}
            <button
              disabled={bulkWorking}
              onClick={() => setDeleteConfirm([...selectedIds])}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {bulkWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Eliminar
            </button>

            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-500 underline hover:text-blue-700">
              Deseleccionar
            </button>
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-10 px-3 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="rounded border-slate-300 accent-blue-600"
                      checked={filteredLeads.length > 0 && filteredLeads.every(l => selectedIds.has(l.id))}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(new Set(filteredLeads.map(l => l.id)))
                        else setSelectedIds(new Set())
                      }}
                    />
                  </th>
                  <SortTh field="contact_name" label="Nombre"  sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Cédula</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Teléfono</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fuente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Citas</th>
                  <SortTh field="status"     label="Estado"      sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                  <SortTh field="created_at" label="Creado"      sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                  <SortTh field="updated_at" label="Actualizado" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={11} className="px-5 py-12 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</span>
                  </td></tr>
                ) : filteredLeads.length === 0 ? (
                  <tr><td colSpan={11} className="px-5 py-12 text-center text-slate-400">No hay leads con los filtros seleccionados.</td></tr>
                ) : filteredLeads.map(lead => {
                  const aptCount = aptCounts[lead.id] ?? 0
                  return (
                    <tr key={lead.id} onClick={() => openLeadDetail(lead)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                      <td className="w-10 px-3 py-3.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 accent-blue-600"
                          checked={selectedIds.has(lead.id)}
                          onChange={e => setSelectedIds(prev => {
                            const next = new Set(prev)
                            e.target.checked ? next.add(lead.id) : next.delete(lead.id)
                            return next
                          })}
                        />
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">{lead.contact_name}{lead.contact_last_name ? ' ' + lead.contact_last_name : ''}{!lead.contact_name && !lead.contact_last_name && 'Sin nombre'}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{lead.contact_cedula || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{lead.contact_phone || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{lead.contact_email || '—'}</td>

                      {/* Fuente inline */}
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <button onClick={e => openPopover(e, setSourcePopover, sourcePopover?.leadId, lead.id, () => setSourcePopover(null))}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 transition hover:ring-2 hover:ring-offset-1 hover:ring-slate-300">
                          {SOURCE_LABELS[lead.source ?? ''] ?? (lead.source || 'Otra')}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                      </td>

                      {/* Citas */}
                      <td className="px-5 py-3.5">
                        {aptCount === 0
                          ? <span className="text-xs text-slate-400">—</span>
                          : <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">{aptCount}</span>}
                      </td>

                      {/* Estado inline */}
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <button onClick={e => openPopover(e, setStatusPopover, statusPopover?.leadId, lead.id, () => setStatusPopover(null))}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 ${STATUS_COLORS[lead.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {statusLabel(lead.status)}
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      </td>

                      <td className="px-5 py-3.5 text-right text-xs text-slate-400">{fmtDate(lead.created_at)}</td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-400">{fmtDate(lead.updated_at)}</td>
                      <td className="px-5 py-3.5 max-w-[180px]">
                        {lead.notes
                          ? <span className="block truncate text-xs text-slate-400" title={lead.notes}>
                              {lead.notes.length > 40 ? lead.notes.slice(0, 40) + '…' : lead.notes}
                            </span>
                          : <span className="text-xs text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Kanban view */}
        {view === 'kanban' && (
          <div className="p-4">
            {isLoading
              ? <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...</div>
              : <KanbanView leads={filteredLeads} aptCounts={aptCounts} onStatusChange={handleInlineStatusChange} onOpenLead={openLeadDetail} />}
          </div>
        )}
      </div>

      {/* ── Source popover ─────────────────────────────────────────────────────── */}
      {sourcePopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSourcePopover(null)} />
          <div className="fixed z-50 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: sourcePopover.top, left: sourcePopover.left }}>
            {SOURCE_OPTIONS.map(s => (
              <button key={s.value} onClick={() => handleInlineSourceChange(sourcePopover.leadId, s.value)}
                className="flex w-full items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Status popover ─────────────────────────────────────────────────────── */}
      {statusPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setStatusPopover(null)} />
          <div className="fixed z-50 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: statusPopover.top, left: statusPopover.left }}>
            {STATUS_PIPELINE.map(s => (
              <button key={s.value} onClick={() => handleInlineStatusChange(statusPopover.leadId, s.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[s.value]}`}>{s.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Lead detail modal ──────────────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDetail} />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">

            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{[selectedLead.contact_name, selectedLead.contact_last_name].filter(Boolean).join(' ') || 'Sin nombre'}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[selectedLead.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {statusLabel(selectedLead.status)}
                  </span>
                  <span className="text-xs text-slate-400">{SOURCE_LABELS[selectedLead.source ?? ''] ?? (selectedLead.source || '—')}</span>
                </div>
              </div>
              <button onClick={closeDetail} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Contact fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</label>
                  <input value={editForm.contact_name} onChange={e => setEditForm(p => ({ ...p, contact_name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Apellido</label>
                  <input value={editForm.contact_last_name} onChange={e => setEditForm(p => ({ ...p, contact_last_name: e.target.value }))}
                    placeholder="—" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cédula</label>
                  <input value={editForm.contact_cedula} onChange={e => setEditForm(p => ({ ...p, contact_cedula: e.target.value }))}
                    placeholder="—" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Teléfono</label>
                  <input value={editForm.contact_phone} onChange={e => setEditForm(p => ({ ...p, contact_phone: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
                  <input type="email" value={editForm.contact_email} onChange={e => setEditForm(p => ({ ...p, contact_email: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fuente</label>
                  <select value={editForm.source} onChange={e => setEditForm(p => ({ ...p, source: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</label>
                  <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUS_PIPELINE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
                  <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3} placeholder="Sin notas..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Dates */}
              <div className="flex gap-4 rounded-xl bg-slate-50 px-4 py-3 text-xs">
                <div>
                  <span className="font-semibold uppercase tracking-wide text-slate-400">Creado</span>
                  <p className="mt-0.5 text-slate-700">{fmtDate(selectedLead.created_at)}</p>
                </div>
                <div className="w-px bg-slate-200" />
                <div>
                  <span className="font-semibold uppercase tracking-wide text-slate-400">Actualizado</span>
                  <p className="mt-0.5 text-slate-700">{fmtDate(selectedLead.updated_at)}</p>
                </div>
              </div>

              {saveLeadError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{saveLeadError}</p>}

              {/* Actions */}
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setBookingModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  <CalendarPlus className="h-4 w-4 text-blue-500" />
                  Agendar nueva cita
                </button>
                <button onClick={handleSaveLead} disabled={savingLead}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50">
                  {savingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar
                </button>
              </div>

              {/* Danger zone */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => selectedLead && setDeleteConfirm([selectedLead.id])}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar lead
                </button>
              </div>

              {/* Appointments */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Citas vinculadas ({leadAppointments.length})
                </p>
                {loadingApts ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                  </div>
                ) : leadAppointments.length === 0 ? (
                  <p className="py-1 text-sm text-slate-400">Sin citas registradas.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Médico</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {leadAppointments.map(apt => (
                          <tr key={apt.id}>
                            <td className="px-4 py-2.5 text-xs text-slate-700">{fmtDateTime(apt.scheduled_at)}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{(apt.doctor?.[0]?.metadata?.name as string) || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${APT_STATUS_COLORS[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                {APT_STATUS_LABELS[apt.status] ?? apt.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Comments ───────────────────────────────────────────────────── */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Comentarios
                </p>

                {/* Comment list */}
                {loadingComments ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                  </div>
                ) : leadComments.length === 0 ? (
                  <p className="py-1 text-sm text-slate-400">Sin comentarios aún.</p>
                ) : (
                  <div className="space-y-2.5 mb-3">
                    {leadComments.map(c => {
                      const author = c.author?.[0]
                      const name = author
                        ? [author.first_name, author.last_name].filter(Boolean).join(' ') || 'Usuario'
                        : 'Usuario'
                      return (
                        <div key={c.id} className="rounded-xl bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-700">{name}</span>
                            <span className="text-[11px] text-slate-400">{fmtTimeAgo(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.comment}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* New comment input */}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveComment() }}
                    rows={2}
                    placeholder="Escribe un comentario... (⌘+Enter para guardar)"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={handleSaveComment}
                    disabled={savingComment || !newComment.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40"
                  >
                    {savingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {selectedLead && organizationId && (
        <BookAppointmentModal
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          onSuccess={async () => {
            setBookingModalOpen(false)
            closeDetail()
            await loadLeads()
            setSuccessToast('Cita agendada correctamente')
            setTimeout(() => setSuccessToast(null), 3000)
          }}
          lead={selectedLead}
          orgId={organizationId}
        />
      )}

      <CreateLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { setIsModalOpen(false); loadLeads() }}
        onCreateLead={createLead}
      />

      <ImportLeadsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        organizationId={organizationId}
        onSuccess={(imported, skipped) => {
          setIsImportModalOpen(false)
          loadLeads()
          const msg = skipped > 0
            ? `${imported} leads importados, ${skipped} duplicados omitidos`
            : `${imported} leads importados`
          setSuccessToast(msg)
          setTimeout(() => setSuccessToast(null), 4000)
        }}
      />

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              {deleteConfirm.length === 1 ? '¿Eliminar este lead?' : `¿Eliminar ${deleteConfirm.length} leads?`}
            </h2>
            <p className="mt-2 text-sm text-slate-500">Esta acción no se puede deshacer.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {successToast && (
        <div className="fixed bottom-4 right-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm text-white shadow-lg">
          {successToast}
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 rounded-2xl bg-red-600 px-5 py-3 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}

