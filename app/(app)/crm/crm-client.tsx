'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreateLeadModal } from '@/components/crm/create-lead-modal'
import { BookAppointmentModal } from '@/components/crm/book-appointment-modal'
import {
  Plus, Loader2, Search, X, Save, List, LayoutGrid,
  ChevronDown, CalendarPlus, ChevronUp, Send,
  FileDown, Upload, Trash2, ContactRound, Download,
} from 'lucide-react'
import { ImportLeadsModal, downloadLeadTemplate } from '@/components/crm/import-leads-modal'
import { deleteLeads } from '@/app/(app)/crm/actions/deleteLeads'
import { bulkUpdateLeadStatus, bulkUpdateLeadSource } from '@/app/(app)/crm/actions/bulkLeadActions'
import { exportLeads } from '@/app/(app)/crm/actions/exportLeads'
import { DatePicker } from '@/components/ui/date-picker'

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
  metadata: Record<string, string> | null
  procedure_id: string | null
  procedure_price: number | null
  created_at: string
  updated_at: string
}

interface ProcedureOption {
  id: string
  name: string
  price: number
  is_active: boolean
}

interface LeadProcedure {
  id: string
  procedure_id: string
  procedure_price: number
  performed_at: string | null
  procedure?: { name: string } | null
}

interface OrgField {
  field_name: string
  field_label: string
  field_type: string
  options: string[] | null
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

const STATUS_DOT: Record<string, { dot: string; keyword: string }> = {
  contactado:               { dot: 'bg-blue-500',    keyword: 'Contactado' },
  cita_valoracion_agendada: { dot: 'bg-violet-500',  keyword: 'Agendada' },
  asistio_cita:             { dot: 'bg-green-500',   keyword: 'Asistió' },
  cancelo_cita:             { dot: 'bg-red-500',     keyword: 'Canceló' },
  en_tratamiento_medico:    { dot: 'bg-yellow-500',  keyword: 'En tratamiento' },
  finalizado:               { dot: 'bg-gray-500',    keyword: 'Finalizado' },
}

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

const SOURCE_DOT: Record<string, { dot: string; keyword: string }> = {
  book:         { dot: 'bg-green-500',  keyword: 'Online' },
  booking:      { dot: 'bg-green-500',  keyword: 'Online' },
  manual:       { dot: 'bg-slate-400',  keyword: 'Manual' },
  instagram:    { dot: 'bg-pink-500',   keyword: 'Instagram' },
  facebook:     { dot: 'bg-blue-600',   keyword: 'Facebook' },
  whatsapp:     { dot: 'bg-green-600',  keyword: 'WhatsApp' },
  manychat:     { dot: 'bg-green-600',  keyword: 'WhatsApp' },
  manychat_n8n: { dot: 'bg-green-600',  keyword: 'WhatsApp' },
  referido:     { dot: 'bg-purple-500', keyword: 'Referido' },
  web:          { dot: 'bg-cyan-500',   keyword: 'Web' },
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

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota',
  }).format(new Date(iso))

const fmtDateOnly = (dateStr: string) => {
  const [y, mo, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(y, mo - 1, d))
}

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

type SortDir = 'asc' | 'desc'
type Popover = { leadId: string; top: number; left: number }

// ── Column filter system ───────────────────────────────────────────────────────

type ColumnType = 'text' | 'enum' | 'number' | 'date'

type TextFilter   = { type: 'text';   op: 'contains' | 'equals' | 'empty'; value: string }
type EnumFilter   = { type: 'enum';   values: string[] }
type NumberFilter = { type: 'number'; op: 'eq' | 'gt' | 'lt'; value: number }
type DateFilter   = { type: 'date';   op: 'before' | 'after'; value: string }
type ColumnFilter = TextFilter | EnumFilter | NumberFilter | DateFilter

interface ColumnDef { key: string; label: string; type: ColumnType }

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'contact_name',   label: 'Nombre',              type: 'text'   },
  { key: 'contact_cedula', label: 'Núm. Identificación', type: 'text'   },
  { key: 'contact_phone',  label: 'Teléfono',            type: 'text'   },
  { key: 'contact_email',  label: 'Email',               type: 'text'   },
  { key: 'status',         label: 'Estado',              type: 'enum'   },
  { key: 'source',         label: 'Fuente',              type: 'enum'   },
  { key: 'aptCount',       label: 'Citas',               type: 'number' },
  { key: 'created_at',     label: 'Creado',              type: 'date'   },
  { key: 'updated_at',     label: 'Actualizado',         type: 'date'   },
  { key: 'notes',          label: 'Notas',               type: 'text'   },
]

function getColEnumOptions(key: string, leads: Lead[], orgFields: OrgField[]): { value: string; label: string }[] {
  if (key === 'status') return STATUS_PIPELINE.map(s => ({ value: s.value, label: s.label }))
  if (key === 'source') {
    const unique = [...new Set(leads.map(l => l.source).filter((v): v is string => v !== null))]
    return unique.map(v => ({ value: v, label: SOURCE_LABELS[v] ?? v }))
  }
  if (key.startsWith('meta:')) {
    const fieldName = key.slice(5)
    const field = orgFields.find(f => f.field_name === fieldName)
    if (field?.options?.length) return field.options.map(v => ({ value: v, label: v }))
    const unique = [...new Set(leads.map(l => l.metadata?.[fieldName]).filter((v): v is string => v !== null && v !== undefined))]
    return unique.map(v => ({ value: v, label: v }))
  }
  return []
}

function applyColumnFilter(key: string, filter: ColumnFilter, lead: Lead, aptCounts: Record<string, number>): boolean {
  const raw = (): string => {
    if (key === 'contact_name') return [lead.contact_name, lead.contact_last_name].filter(Boolean).join(' ')
    if (key === 'aptCount') return String(aptCounts[lead.id] ?? 0)
    if (key.startsWith('meta:')) return String(lead.metadata?.[key.slice(5)] ?? '')
    return String((lead as unknown as Record<string, unknown>)[key] ?? '')
  }
  if (filter.type === 'text') {
    const val = raw()
    const lo = val.toLowerCase()
    const flo = filter.value.toLowerCase()
    if (filter.op === 'contains') return lo.includes(flo)
    if (filter.op === 'equals')   return lo === flo
    if (filter.op === 'empty')    return !val.trim()
    return true
  }
  if (filter.type === 'enum') {
    if (!filter.values.length) return true
    return filter.values.includes(raw())
  }
  if (filter.type === 'number') {
    const num = key === 'aptCount' ? (aptCounts[lead.id] ?? 0) : parseFloat(raw())
    if (filter.op === 'eq') return num === filter.value
    if (filter.op === 'gt') return num > filter.value
    if (filter.op === 'lt') return num < filter.value
    return true
  }
  if (filter.type === 'date') {
    const str = raw()
    if (!str) return false
    const ld = new Date(str).getTime()
    const fd = new Date(filter.value).getTime()
    if (filter.op === 'after')  return ld >= fd
    if (filter.op === 'before') return ld <= fd
    return true
  }
  return true
}

function compareLeads(a: Lead, b: Lead, sf: string, aptCounts: Record<string, number>): number {
  if (sf === 'contact_name') {
    const na = [a.contact_name, a.contact_last_name].filter(Boolean).join(' ')
    const nb = [b.contact_name, b.contact_last_name].filter(Boolean).join(' ')
    return na.localeCompare(nb, 'es')
  }
  if (sf === 'status')   return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  if (sf === 'aptCount') return (aptCounts[a.id] ?? 0) - (aptCounts[b.id] ?? 0)
  if (sf === 'created_at' || sf === 'updated_at') {
    return new Date(a[sf]).getTime() - new Date(b[sf]).getTime()
  }
  if (sf.startsWith('meta:')) {
    const fn = sf.slice(5)
    return String(a.metadata?.[fn] ?? '').localeCompare(String(b.metadata?.[fn] ?? ''), 'es')
  }
  const va = String((a as unknown as Record<string, unknown>)[sf] ?? '')
  const vb = String((b as unknown as Record<string, unknown>)[sf] ?? '')
  return va.localeCompare(vb, 'es')
}

// ── Column header component ────────────────────────────────────────────────────

function ColumnHeader({
  colKey, label, sortField, sortDir, hasFilter, onOpen, className = '',
}: {
  colKey: string; label: string
  sortField: string | null; sortDir: SortDir
  hasFilter: boolean
  onOpen: (e: React.MouseEvent) => void
  className?: string
}) {
  const isActive = sortField === colKey
  return (
    <th
      onClick={onOpen}
      className={`cursor-pointer select-none px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (sortDir === 'asc'
          ? <ChevronUp   className="h-3 w-3 text-[#215F73]" />
          : <ChevronDown className="h-3 w-3 text-[#215F73]" />)}
        {hasFilter && <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[#215F73]" />}
      </span>
    </th>
  )
}

// ── Column menu popover ────────────────────────────────────────────────────────

function ColumnMenuPopover({
  colKey, colType, sortField, sortDir, currentFilter, enumOptions,
  onSortAsc, onSortDesc, onApplyFilter, onClearFilter, onClose, style,
}: {
  colKey: string; colType: ColumnType
  sortField: string | null; sortDir: SortDir
  currentFilter?: ColumnFilter
  enumOptions?: { value: string; label: string }[]
  onSortAsc: () => void; onSortDesc: () => void
  onApplyFilter: (f: ColumnFilter) => void; onClearFilter: () => void
  onClose: () => void
  style: React.CSSProperties
}) {
  const [textOp,  setTextOp]  = useState<'contains' | 'equals' | 'empty'>(
    currentFilter?.type === 'text' ? currentFilter.op : 'contains'
  )
  const [textVal, setTextVal] = useState(currentFilter?.type === 'text' ? currentFilter.value : '')
  const [enumVals, setEnumVals] = useState<string[]>(currentFilter?.type === 'enum' ? currentFilter.values : [])
  const [numOp,  setNumOp]  = useState<'eq' | 'gt' | 'lt'>(currentFilter?.type === 'number' ? currentFilter.op : 'eq')
  const [numVal, setNumVal] = useState(currentFilter?.type === 'number' ? String(currentFilter.value) : '')
  const [dateOp, setDateOp] = useState<'before' | 'after'>(currentFilter?.type === 'date' ? currentFilter.op : 'after')
  const [dateVal, setDateVal] = useState(currentFilter?.type === 'date' ? currentFilter.value : '')

  const sortAscLabel  = colType === 'date' ? 'Más antiguo' : colType === 'number' ? 'Menor primero' : 'A → Z'
  const sortDescLabel = colType === 'date' ? 'Más reciente' : colType === 'number' ? 'Mayor primero' : 'Z → A'

  const applyFilter = () => {
    if (colType === 'text') {
      onApplyFilter({ type: 'text', op: textOp, value: textVal })
    } else if (colType === 'enum') {
      if (enumVals.length > 0) onApplyFilter({ type: 'enum', values: enumVals })
      else onClearFilter()
    } else if (colType === 'number') {
      onApplyFilter({ type: 'number', op: numOp, value: parseFloat(numVal) || 0 })
    } else if (colType === 'date') {
      onApplyFilter({ type: 'date', op: dateOp, value: dateVal })
    }
    onClose()
  }

  return (
    <div className="fixed z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" style={style}>
      {/* Sort */}
      <div className="border-b border-slate-100 py-1">
        <button
          onClick={() => { onSortAsc(); onClose() }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition${sortField === colKey && sortDir === 'asc' ? ' font-semibold text-[#215F73]' : ''}`}
        >
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />{sortAscLabel}
        </button>
        <button
          onClick={() => { onSortDesc(); onClose() }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition${sortField === colKey && sortDir === 'desc' ? ' font-semibold text-[#215F73]' : ''}`}
        >
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />{sortDescLabel}
        </button>
      </div>

      {/* Filter */}
      <div className="p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Filtrar</p>

        {colType === 'text' && (
          <>
            <select value={textOp} onChange={e => setTextOp(e.target.value as 'contains' | 'equals' | 'empty')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="contains">Contiene</option>
              <option value="equals">Es igual a</option>
              <option value="empty">Está vacío</option>
            </select>
            {textOp !== 'empty' && (
              <input value={textVal} onChange={e => setTextVal(e.target.value)} placeholder="Valor..."
                autoFocus
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
            )}
          </>
        )}

        {colType === 'enum' && enumOptions && (
          <div className="max-h-36 overflow-y-auto space-y-0.5">
            {enumOptions.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer rounded-md px-1.5 py-1 hover:bg-slate-50 transition">
                <input type="checkbox" className="rounded border-slate-300 accent-blue-600"
                  checked={enumVals.includes(opt.value)}
                  onChange={e => setEnumVals(p => e.target.checked ? [...p, opt.value] : p.filter(v => v !== opt.value))} />
                <span className="text-xs text-slate-700 truncate">{opt.label}</span>
              </label>
            ))}
          </div>
        )}

        {colType === 'number' && (
          <>
            <select value={numOp} onChange={e => setNumOp(e.target.value as 'eq' | 'gt' | 'lt')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="eq">Igual a</option>
              <option value="gt">Mayor que</option>
              <option value="lt">Menor que</option>
            </select>
            <input type="number" value={numVal} onChange={e => setNumVal(e.target.value)} placeholder="0"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </>
        )}

        {colType === 'date' && (
          <>
            <select value={dateOp} onChange={e => setDateOp(e.target.value as 'before' | 'after')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="after">Después de</option>
              <option value="before">Antes de</option>
            </select>
            <DatePicker value={dateVal} onChange={setDateVal} placeholder="Seleccionar fecha" />
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={applyFilter}
            className="flex-1 rounded-lg bg-[#215F73] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#0D2B3E] transition">
            Aplicar
          </button>
          <button onClick={() => { onClearFilter(); onClose() }}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
            Limpiar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Kanban view ───────────────────────────────────────────────────────────────

function KanbanView({
  leads, aptCounts, onStatusChange, onOpenLead, readOnly = false,
}: {
  leads: Lead[]
  aptCounts: Record<string, number>
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>
  onOpenLead: (lead: Lead) => void
  readOnly?: boolean
}) {
  const [dragLeadId,  setDragLeadId]  = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  return (
    <div className="flex gap-3 pb-2" style={{ minWidth: '960px' }}>
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
                if (!readOnly && dragLeadId) await onStatusChange(dragLeadId, stage.value)
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
                  <div key={lead.id} draggable={!readOnly}
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
  )
}

// ── CrmPage ───────────────────────────────────────────────────────────────────

export default function CrmPage({ readOnly = false }: { readOnly?: boolean }) {
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

  // column filter + sort
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({})
  const [colMenu, setColMenu] = useState<{ key: string; top: number; left: number } | null>(null)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')

  // popovers (inline row edit)
  const [statusPopover, setStatusPopover] = useState<Popover | null>(null)
  const [sourcePopover, setSourcePopover] = useState<Popover | null>(null)

  // lead detail
  const [selectedLead,     setSelectedLead]     = useState<Lead | null>(null)
  const [leadAppointments, setLeadAppointments] = useState<LeadAppointment[]>([])
  const [loadingApts,      setLoadingApts]      = useState(false)
  const [editForm,         setEditForm]         = useState<{
    contact_name: string; contact_last_name: string; contact_phone: string; contact_email: string;
    contact_cedula: string; notes: string; status: string; source: string;
    metadata: Record<string, string>;
  }>({
    contact_name: '', contact_last_name: '', contact_phone: '', contact_email: '',
    contact_cedula: '', notes: '', status: '', source: '', metadata: {},
  })
  const [savingLead,    setSavingLead]    = useState(false)
  const [saveLeadError, setSaveLeadError] = useState<string | null>(null)
  const [successToast,    setSuccessToast]    = useState<string | null>(null)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [orgPlan,           setOrgPlan]           = useState<string | null>(null)
  const [exporting,         setExporting]         = useState(false)

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

  // custom fields
  const [orgFields, setOrgFields] = useState<OrgField[]>([])
  const [addFieldOpen,  setAddFieldOpen]  = useState(false)
  const [newFieldForm,  setNewFieldForm]  = useState({ field_label: '', field_type: 'text', options: '' })
  const [savingField,   setSavingField]   = useState(false)

  // procedures
  const [procedures,       setProcedures]       = useState<ProcedureOption[]>([])
  const [editProcedureId,  setEditProcedureId]  = useState<string | null>(null)
  const [leadProcedures,   setLeadProcedures]   = useState<LeadProcedure[]>([])
  const [loadingLeadProcs, setLoadingLeadProcs] = useState(false)
  const [addProcId,        setAddProcId]        = useState<string>('')
  const [showAddProc,      setShowAddProc]      = useState(false)
  const [addProcMonth,     setAddProcMonth]     = useState<string>('')
  const [addProcYear,      setAddProcYear]      = useState<number>(new Date().getFullYear())

  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: member } = await supabase
        .from('organization_members').select('organization_id').eq('user_id', user.id).single()
      const orgId = member?.organization_id ?? null
      setOrganizationId(orgId)
      if (orgId) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('plan')
          .eq('id', orgId)
          .single()
        setOrgPlan((orgData as { plan: string } | null)?.plan ?? null)
        await reloadOrgFields(orgId)
      }
      await loadLeads()
      fetch('/api/procedures').then(r => r.ok ? r.json() : []).then(setProcedures).catch(() => {})
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

  const reloadOrgFields = async (orgId: string) => {
    const { data: fields } = await supabase
      .from('crm_fields')
      .select('field_name, field_label, field_type, options')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    setOrgFields((fields ?? []) as OrgField[])
  }

  const loadLeads = async () => {
    setIsLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('leads')
        .select('id, contact_name, contact_last_name, contact_phone, contact_email, contact_cedula, source, status, notes, metadata, procedure_id, procedure_price, created_at, updated_at')
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

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await exportLeads({ status: statusFilter, source: sourceFilter, search })
      if ('error' in result) {
        setError(result.error)
        return
      }
      const binary = atob(result.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
      setSuccessToast(`${result.count} leads exportados`)
      setTimeout(() => setSuccessToast(null), 3000)
    } finally {
      setExporting(false)
    }
  }

  // ── Lead detail ──────────────────────────────────────────────────────────────

  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead)
    setEditProcedureId(lead.procedure_id ?? null)
    setLeadProcedures([])
    setShowAddProc(false)
    setAddProcId('')
    setAddProcMonth('')
    setAddProcYear(new Date().getFullYear())
    setLoadingLeadProcs(true)
    fetch(`/api/lead-procedures?leadId=${lead.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(setLeadProcedures)
      .catch(() => {})
      .finally(() => setLoadingLeadProcs(false))
    setEditForm({
      contact_name:      lead.contact_name      ?? '',
      contact_last_name: lead.contact_last_name ?? '',
      contact_phone:     lead.contact_phone     ?? '',
      contact_email:     lead.contact_email     ?? '',
      contact_cedula:    lead.contact_cedula    ?? '',
      notes:             lead.notes             ?? '',
      status:            lead.status,
      source:            lead.source            ?? '',
      metadata:          (lead.metadata as Record<string, string>) ?? {},
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
    const mergedMetadata: Record<string, string> = { ...(selectedLead.metadata ?? {}) }
    for (const f of orgFields) {
      const val = editForm.metadata[f.field_name]
      if (val && val.trim()) mergedMetadata[f.field_name] = val.trim()
      else delete mergedMetadata[f.field_name]
    }
    const { error } = await supabase.from('leads').update({
      contact_name:      editForm.contact_name.trim()      || null,
      contact_last_name: editForm.contact_last_name.trim() || null,
      contact_phone:     editForm.contact_phone.trim()     || null,
      contact_email:     editForm.contact_email.trim()     || null,
      contact_cedula:    editForm.contact_cedula.trim()    || null,
      notes:             editForm.notes.trim()             || null,
      status:            editForm.status,
      source:            editForm.source                   || null,
      metadata:          Object.keys(mergedMetadata).length > 0 ? mergedMetadata : null,
      updated_at:        now,
    }).eq('id', selectedLead.id)
    if (error) { setSaveLeadError(error.message); setSavingLead(false); return }
    await loadLeads()
    setSavingLead(false)
    closeDetail()
    setSuccessToast('Lead actualizado')
    setTimeout(() => setSuccessToast(null), 3000)
  }

  const handleAddProcedure = async () => {
    if (!selectedLead || !addProcId) return
    const proc = procedures.find(p => p.id === addProcId)
    if (!proc) return

    // Mes/Año → performed_at = 'YYYY-MM-01'. Si no eligen mes, queda null.
    const performed_at = addProcMonth
      ? `${addProcYear}-${String(addProcMonth).padStart(2, '0')}-01`
      : null

    const res = await fetch('/api/lead-procedures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: selectedLead.id,
        procedure_id: proc.id,
        procedure_price: proc.price,
        performed_at,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setLeadProcedures(prev => [...prev, created])
      setAddProcId('')
      setAddProcMonth('')
      setAddProcYear(new Date().getFullYear())
      setShowAddProc(false)
    }
  }

  const handleRemoveProcedure = async (id: string) => {
    const res = await fetch('/api/lead-procedures', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setLeadProcedures(prev => prev.filter(p => p.id !== id))
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

  const handleAddField = async () => {
    if (!organizationId || !newFieldForm.field_label.trim()) return
    setSavingField(true)
    const slug = newFieldForm.field_label.trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    const { error } = await supabase.from('org_custom_fields').insert({
      organization_id: organizationId,
      field_name:  slug,
      field_label: newFieldForm.field_label.trim(),
      field_type:  newFieldForm.field_type,
      options:     newFieldForm.field_type === 'select'
        ? newFieldForm.options.split(',').map(o => o.trim()).filter(Boolean)
        : null,
      source:      'crm',
      sort_order:  orgFields.length,
      active:      true,
    })
    setSavingField(false)
    if (!error) {
      await reloadOrgFields(organizationId)
      setAddFieldOpen(false)
      setNewFieldForm({ field_label: '', field_type: 'text', options: '' })
    }
  }

  // ── Filtered + sorted leads ──────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    const filtered = leads.filter(lead => {
      const q = search.toLowerCase()
      if (search && !(
        lead.contact_name?.toLowerCase().includes(q) ||
        lead.contact_last_name?.toLowerCase().includes(q) ||
        lead.contact_phone?.includes(search) ||
        lead.contact_email?.toLowerCase().includes(q) ||
        lead.contact_cedula?.includes(search) ||
        Object.values(lead.metadata ?? {}).some(v => String(v).toLowerCase().includes(q))
      )) return false
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false
      for (const [key, filter] of Object.entries(columnFilters)) {
        if (!applyColumnFilter(key, filter, lead, aptCounts)) return false
      }
      return true
    })

    if (!sortField) return filtered

    return [...filtered].sort((a, b) => {
      const cmp = compareLeads(a, b, sortField, aptCounts)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, statusFilter, sourceFilter, search, sortField, sortDir, columnFilters, aptCounts])

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
    const checkRes = await fetch('/api/plans/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: organizationId, resource: 'leads' }),
    }).then(r => r.json())
    if (!checkRes.allowed) {
      return { success: false, error: checkRes.error ?? `Has alcanzado el límite de ${checkRes.limit} leads en tu plan ${checkRes.plan}. Actualiza tu plan para continuar.` }
    }
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

  const openColMenu = (e: React.MouseEvent, key: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const left = rect.left + 224 > window.innerWidth ? window.innerWidth - 228 : rect.left
    setColMenu({ key, top: rect.bottom + 4, left })
  }

  const canExport = orgPlan === 'clinica' || orgPlan === 'red'
  const hasActiveFilters = Object.keys(columnFilters).length > 0 || sortField !== null || statusFilter !== 'all'

  const colMenuDef = colMenu ? (() => {
    const coreDef = COLUMN_DEFS.find(c => c.key === colMenu.key)
    const orgField = colMenu.key.startsWith('meta:')
      ? orgFields.find(f => `meta:${f.field_name}` === colMenu.key)
      : null
    const colType: ColumnType = coreDef?.type ?? (orgField?.field_type === 'select' ? 'enum' : 'text')
    const enumOptions = colType === 'enum' ? getColEnumOptions(colMenu.key, leads, orgFields) : undefined
    return { colType, enumOptions }
  })() : null

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen px-2">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-2 py-2 border-b border-slate-100">
        <h1 className="text-base font-semibold text-slate-900">
          CRM / Leads <span className="text-xs font-normal text-slate-400 ml-1">· {filteredLeads.length} leads</span>
        </h1>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button onClick={() => setView('list')} className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button onClick={() => setView('kanban')} className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${view === 'kanban' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
          </div>
          <button onClick={downloadLeadTemplate} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
            <FileDown className="h-3.5 w-3.5" /> Template
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport || exporting}
            title={!canExport ? 'Disponible en planes Growth y Scale' : undefined}
            className={`inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition${!canExport ? ' opacity-50 cursor-not-allowed' : ''}`}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar
          </button>
          {!readOnly && (
            <button onClick={() => setIsImportModalOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
              <Upload className="h-3.5 w-3.5" /> Importar
            </button>
          )}
          {!readOnly && (
            <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition">
              <Plus className="h-3.5 w-3.5" /> Crear lead
            </button>
          )}
        </div>
      </div>

      {/* Pipeline pills */}
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 flex-wrap">
        {STATUS_PIPELINE.map(stage => {
          const count = leads.filter(l => l.status === stage.value).length
          const isActive = statusFilter === stage.value
          return (
            <button key={stage.value} onClick={() => setStatusFilter(isActive ? 'all' : stage.value)}
              className={['inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition', isActive ? (PIPELINE_ACCENT[stage.value] ?? 'border border-blue-300 bg-blue-50 text-blue-700') : 'bg-slate-100 text-slate-600 hover:bg-slate-200'].join(' ')}>
              <span className="font-semibold text-slate-900">{count}</span>
              {stage.label}
            </button>
          )
        })}
      </div>

      {/* Table area */}
      <div className="flex flex-col flex-1 min-h-0 bg-white">
        {!isLoading && leads.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-2xl bg-[#EBF0F6] p-3">
                <ContactRound className="h-12 w-12 text-[#5A9DB5]" />
              </div>
              <h2 className="text-lg font-semibold text-[#0D2B3E]">Aún no tienes pacientes</h2>
              <p className="text-sm text-[#4A6B7A] max-w-sm">Los leads aparecerán aquí cuando alguien agende una cita o los importes.</p>
              {!readOnly && (
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="rounded-xl bg-[#215F73] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2B3E]"
                >
                  Importar leads
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
        {/* Filters */}
        <div className="shrink-0 flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
          {hasActiveFilters && (
            <button
              onClick={() => { setColumnFilters({}); setSortField(null); setStatusFilter('all') }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <X className="h-3 w-3" /> Limpiar filtros
            </button>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, teléfono, cédula o email..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Bulk-action bar */}
        {selectedIds.size > 0 && !readOnly && (
          <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-blue-50 px-2 py-1.5">
            <span className="shrink-0 text-sm font-medium text-blue-700">
              {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>

            <select
              disabled={bulkWorking}
              value=""
              onChange={e => { if (e.target.value) handleBulkStatus(e.target.value) }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none disabled:opacity-50"
            >
              <option value="" disabled>Cambiar estado</option>
              {STATUS_PIPELINE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <select
              disabled={bulkWorking}
              value=""
              onChange={e => { if (e.target.value) handleBulkSource(e.target.value) }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none disabled:opacity-50"
            >
              <option value="" disabled>Cambiar fuente</option>
              {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

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
          <div
            className="flex-1 min-h-0 overflow-x-auto overflow-y-auto"
            style={{ scrollbarGutter: 'stable' }}
          >
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-200">
                  <th className="w-10 px-3 py-2">
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
                  <ColumnHeader colKey="contact_name"   label="Nombre"              sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['contact_name']}   onOpen={e => openColMenu(e, 'contact_name')}   className="min-w-[140px]" />
                  <ColumnHeader colKey="contact_cedula" label="Núm. Identificación" sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['contact_cedula']} onOpen={e => openColMenu(e, 'contact_cedula')} className="min-w-[100px]" />
                  <ColumnHeader colKey="contact_phone"  label="Teléfono"            sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['contact_phone']}  onOpen={e => openColMenu(e, 'contact_phone')}  className="min-w-[120px]" />
                  <ColumnHeader colKey="contact_email"  label="Email"               sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['contact_email']}  onOpen={e => openColMenu(e, 'contact_email')}  className="min-w-[180px]" />
                  <ColumnHeader colKey="status"         label="Estado"              sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['status']}         onOpen={e => openColMenu(e, 'status')}         className="min-w-[120px]" />
                  <ColumnHeader colKey="source"         label="Fuente"              sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['source']}         onOpen={e => openColMenu(e, 'source')}         className="min-w-[100px]" />
                  <ColumnHeader colKey="aptCount"       label="Citas"               sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['aptCount']}       onOpen={e => openColMenu(e, 'aptCount')}       className="w-16" />
                  <ColumnHeader colKey="created_at"     label="Creado"              sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['created_at']}     onOpen={e => openColMenu(e, 'created_at')}     className="text-right" />
                  <ColumnHeader colKey="updated_at"     label="Actualizado"         sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['updated_at']}     onOpen={e => openColMenu(e, 'updated_at')}     className="text-right" />
                  <ColumnHeader colKey="notes"          label="Notas"               sortField={sortField} sortDir={sortDir} hasFilter={!!columnFilters['notes']}          onOpen={e => openColMenu(e, 'notes')} />
                  {orgFields.map(f => (
                    <ColumnHeader
                      key={f.field_name}
                      colKey={`meta:${f.field_name}`}
                      label={f.field_label}
                      sortField={sortField} sortDir={sortDir}
                      hasFilter={!!columnFilters[`meta:${f.field_name}`]}
                      onOpen={e => openColMenu(e, `meta:${f.field_name}`)}
                      className="whitespace-nowrap"
                    />
                  ))}
                  {!readOnly && (
                    <th className="px-2 py-2 w-10">
                      <button
                        onClick={() => setAddFieldOpen(true)}
                        className="rounded-lg p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition"
                        title="Agregar campo"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={11 + orgFields.length + (readOnly ? 0 : 1)} className="px-3 py-12 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</span>
                  </td></tr>
                ) : filteredLeads.length === 0 ? (
                  <tr><td colSpan={11 + orgFields.length + (readOnly ? 0 : 1)} className="px-3 py-12 text-center text-slate-400">No hay leads con los filtros seleccionados.</td></tr>
                ) : filteredLeads.map(lead => {
                  const aptCount = aptCounts[lead.id] ?? 0
                  return (
                    <tr key={lead.id} onClick={() => openLeadDetail(lead)} className="cursor-pointer hover:bg-slate-50/50 transition-colors">
                      <td className="w-10 px-3 py-2" onClick={e => e.stopPropagation()}>
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
                      <td className="px-3 py-2 font-medium text-slate-900 min-w-[140px]">{lead.contact_name}{lead.contact_last_name ? ' ' + lead.contact_last_name : ''}{!lead.contact_name && !lead.contact_last_name && 'Sin nombre'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 min-w-[100px]">{lead.contact_cedula || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 min-w-[120px]">{lead.contact_phone || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 min-w-[180px]">{lead.contact_email || '—'}</td>

                      {/* Estado inline */}
                      <td className="px-3 py-2 max-w-[140px] whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {readOnly ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-slate-700">
                            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[lead.status]?.dot ?? 'bg-slate-400'}`} />
                            <span className="truncate max-w-[100px]">{STATUS_DOT[lead.status]?.keyword ?? statusLabel(lead.status)}</span>
                          </span>
                        ) : (
                          <button
                            onClick={e => openPopover(e, setStatusPopover, statusPopover?.leadId, lead.id, () => setStatusPopover(null))}
                            title={statusLabel(lead.status)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                          >
                            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[lead.status]?.dot ?? 'bg-slate-400'}`} />
                            <span className="truncate max-w-[100px]">{STATUS_DOT[lead.status]?.keyword ?? statusLabel(lead.status)}</span>
                            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                          </button>
                        )}
                      </td>

                      {/* Fuente inline */}
                      <td className="px-3 py-2 max-w-[140px] whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {readOnly ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-slate-700">
                            <span className="truncate max-w-[100px]">
                              {SOURCE_DOT[lead.source ?? '']?.keyword ?? (lead.source ? lead.source.slice(0, 15) + (lead.source.length > 15 ? '…' : '') : 'Otra')}
                            </span>
                          </span>
                        ) : (
                          <button
                            onClick={e => openPopover(e, setSourcePopover, sourcePopover?.leadId, lead.id, () => setSourcePopover(null))}
                            title={SOURCE_LABELS[lead.source ?? ''] ?? (lead.source || 'Otra')}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                          >
                            <span className="truncate max-w-[100px]">
                              {SOURCE_DOT[lead.source ?? '']?.keyword ?? (lead.source ? lead.source.slice(0, 15) + (lead.source.length > 15 ? '…' : '') : 'Otra')}
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                          </button>
                        )}
                      </td>

                      {/* Citas */}
                      <td className="px-3 py-2 w-16">
                        {aptCount === 0
                          ? <span className="text-xs text-slate-400">—</span>
                          : <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">{aptCount}</span>}
                      </td>

                      <td className="px-3 py-2 text-right text-xs text-slate-400">{fmtDate(lead.created_at)}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">{fmtDate(lead.updated_at)}</td>
                      <td className="px-3 py-2 max-w-[180px]">
                        {lead.notes
                          ? <span className="block truncate text-xs text-slate-400" title={lead.notes}>
                              {lead.notes.length > 40 ? lead.notes.slice(0, 40) + '…' : lead.notes}
                            </span>
                          : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      {orgFields.map(f => (
                        <td key={f.field_name} className="px-3 py-2 max-w-[180px]">
                          {lead.metadata?.[f.field_name]
                            ? <span className="block truncate text-xs text-slate-500" title={String(lead.metadata[f.field_name])}>
                                {String(lead.metadata[f.field_name]).length > 40 ? String(lead.metadata[f.field_name]).slice(0, 40) + '…' : String(lead.metadata[f.field_name])}
                              </span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>
                      ))}
                      {!readOnly && <td className="px-2 py-2 w-10" />}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Kanban view */}
        {view === 'kanban' && (
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto p-4" style={{ scrollbarGutter: 'stable' }}>
            {isLoading
              ? <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...</div>
              : <KanbanView leads={filteredLeads} aptCounts={aptCounts} onStatusChange={handleInlineStatusChange} onOpenLead={openLeadDetail} readOnly={readOnly} />}
          </div>
        )}
          </>
        )}
      </div>

      {/* ── Column menu popover ───────────────────────────────────────────────────── */}
      {colMenu && colMenuDef && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setColMenu(null)} />
          <ColumnMenuPopover
            key={colMenu.key}
            colKey={colMenu.key}
            colType={colMenuDef.colType}
            sortField={sortField}
            sortDir={sortDir}
            currentFilter={columnFilters[colMenu.key]}
            enumOptions={colMenuDef.enumOptions}
            onSortAsc={() => { setSortField(colMenu.key); setSortDir('asc') }}
            onSortDesc={() => { setSortField(colMenu.key); setSortDir('desc') }}
            onApplyFilter={f => setColumnFilters(prev => ({ ...prev, [colMenu.key]: f }))}
            onClearFilter={() => setColumnFilters(prev => { const n = { ...prev }; delete n[colMenu.key]; return n })}
            onClose={() => setColMenu(null)}
            style={{ top: colMenu.top, left: colMenu.left }}
          />
        </>
      )}

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

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Número de Identificación</label>
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
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Procedimientos realizados</label>

                  {loadingLeadProcs ? (
                    <p className="mt-2 text-sm text-slate-400">Cargando...</p>
                  ) : leadProcedures.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {leadProcedures.map(lp => (
                        <div key={lp.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-700">{lp.procedure?.name ?? 'Procedimiento'}</p>
                            <p className="text-xs text-slate-500">
                              {formatCOP(lp.procedure_price)}
                              {lp.performed_at ? ` · ${fmtDateOnly(lp.performed_at)}` : ''}
                            </p>
                          </div>
                          {!readOnly && (
                            <button onClick={() => handleRemoveProcedure(lp.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!readOnly && (leadProcedures.length === 0 || showAddProc) && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Procedimiento</label>
                        <select value={addProcId} onChange={e => setAddProcId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">— Seleccionar —</option>
                          {procedures.filter(p => p.is_active).map(p => (
                            <option key={p.id} value={p.id}>{p.name} — {formatCOP(p.price)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mes del procedimiento (para reportes)</label>
                          <select value={addProcMonth} onChange={e => setAddProcMonth(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— Sin mes —</option>
                            {MONTHS_ES.map((m, i) => (
                              <option key={i} value={i + 1}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Año</label>
                          <select value={addProcYear} onChange={e => setAddProcYear(Number(e.target.value))}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <button onClick={handleAddProcedure} disabled={!addProcId}
                          className="rounded-xl bg-[#215F73] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D2B3E] transition disabled:opacity-40">
                          Agregar
                        </button>
                      </div>
                    </div>
                  )}

                  {!readOnly && leadProcedures.length > 0 && !showAddProc && (
                    <button onClick={() => setShowAddProc(true)}
                      className="mt-2 text-xs font-medium text-blue-600 underline hover:text-blue-800 transition">
                      + Agregar otro procedimiento
                    </button>
                  )}
                </div>
                {orgFields.length > 0 && orgFields.map(f => (
                  <div key={f.field_name} className={f.field_type === 'textarea' ? 'col-span-2' : ''}>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{f.field_label}</label>
                    {f.field_type === 'select' && f.options ? (
                      <select
                        value={editForm.metadata[f.field_name] ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, metadata: { ...p.metadata, [f.field_name]: e.target.value } }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">—</option>
                        {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : f.field_type === 'textarea' ? (
                      <textarea
                        value={editForm.metadata[f.field_name] ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, metadata: { ...p.metadata, [f.field_name]: e.target.value } }))}
                        rows={2} placeholder="—"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <input
                        type={f.field_type === 'number' ? 'number' : 'text'}
                        value={editForm.metadata[f.field_name] ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, metadata: { ...p.metadata, [f.field_name]: e.target.value } }))}
                        placeholder="—"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
                  <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3} placeholder="Sin notas..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

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

              {!readOnly && (
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
              )}

              {!readOnly && (
                <div className="border-t border-slate-100 pt-4">
                  <button
                    onClick={() => selectedLead && setDeleteConfirm([selectedLead.id])}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar lead
                  </button>
                </div>
              )}

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

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Comentarios</p>
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
                {!readOnly && (
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
                )}
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

      {/* Add field modal */}
      {addFieldOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Agregar campo</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Nombre del campo *</label>
                <input
                  type="text"
                  value={newFieldForm.field_label}
                  onChange={e => setNewFieldForm(p => ({ ...p, field_label: e.target.value }))}
                  placeholder="Ej: Diagnóstico, Seguro, Referido por..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Tipo</label>
                <select
                  value={newFieldForm.field_type}
                  onChange={e => setNewFieldForm(p => ({ ...p, field_type: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">Texto</option>
                  <option value="email">Email</option>
                  <option value="tel">Teléfono</option>
                  <option value="number">Número</option>
                  <option value="date">Fecha</option>
                  <option value="textarea">Área de texto</option>
                  <option value="select">Desplegable</option>
                </select>
              </div>
              {newFieldForm.field_type === 'select' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Opciones (separadas por coma)</label>
                  <input
                    type="text"
                    value={newFieldForm.options}
                    onChange={e => setNewFieldForm(p => ({ ...p, options: e.target.value }))}
                    placeholder="Opción 1, Opción 2, Opción 3"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setAddFieldOpen(false); setNewFieldForm({ field_label: '', field_type: 'text', options: '' }) }}
                disabled={savingField}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddField}
                disabled={savingField || !newFieldForm.field_label.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                {savingField && <Loader2 className="h-4 w-4 animate-spin" />}
                Agregar campo
              </button>
            </div>
          </div>
        </div>
      )}

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
