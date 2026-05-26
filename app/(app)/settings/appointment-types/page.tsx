'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Copy, Check, Loader2, Pencil, Link2, X, Save, Settings, Clock, ClipboardList, GripVertical, Trash2 } from 'lucide-react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type AssignmentMode = 'one_on_one' | 'round_robin_proportional' | 'round_robin_availability' | 'hybrid'

interface AppointmentType {
  id: string
  name: string
  slug: string
  duration_minutes: number
  color: string
  modality: 'presencial' | 'virtual' | 'patient_choice'
  price: number | null
  active: boolean
  assignment_mode: AssignmentMode
  doctor_ids: string[]
  min_notice_hours: number
  max_notice_days: number
  buffer_before_min: number
  buffer_after_min: number
  languages: string[]
  rr_count_all: boolean
}

interface FormFieldRow {
  id: string
  field_name: string
  field_label: string
  field_type: string
  placeholder: string
  required: boolean
  sort_order: number
  active: boolean
}

const FIELD_TYPES = [
  { value: 'text',     label: 'Texto' },
  { value: 'email',    label: 'Email' },
  { value: 'tel',      label: 'Teléfono' },
  { value: 'number',   label: 'Número' },
  { value: 'date',     label: 'Fecha' },
  { value: 'textarea', label: 'Área de texto' },
]

const EMPTY_FIELD = {
  field_label:  '',
  field_name:   '',
  field_type:   'text',
  placeholder:  '',
  required:     false,
}

interface DoctorOption {
  id: string
  name: string
}

interface OrgInfo {
  id: string
  slug: string
}

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#14B8A6', '#F97316', '#6366F1',
]

const ASSIGNMENT_MODES: { value: AssignmentMode; label: string }[] = [
  { value: 'hybrid',                    label: 'Flexible — paciente elige o el sistema asigna' },
  { value: 'one_on_one',                label: 'Elección directa — paciente siempre elige médico' },
  { value: 'round_robin_proportional',  label: 'Auto-asignación balanceada — médico con menos citas' },
]

const ASSIGNMENT_MODE_OPTIONS = [
  { value: 'hybrid',                   label: 'Flexible',                     desc: 'El paciente puede elegir médico o dejarlo al sistema' },
  { value: 'one_on_one',               label: 'El paciente elige',             desc: 'El paciente siempre selecciona su médico' },
  { value: 'round_robin_proportional', label: 'Sistema asigna — balanceado',   desc: 'Asigna automáticamente al médico con menos citas del período' },
]

const EMPTY_FORM = {
  name: '',
  slug: '',
  duration_minutes: 60,
  color: '#3B82F6',
  modality: 'patient_choice' as 'presencial' | 'virtual' | 'patient_choice',
  price: '',
  assignment_mode: 'hybrid' as AssignmentMode,
  doctor_ids: [] as string[],
  min_notice_hours: 24,
  max_notice_days: 60,
  buffer_before_min: 0,
  buffer_after_min: 0,
  languages: ['es'] as string[],
  rr_count_all: true,
}

const BASE_FIELDS = [
  { label: 'Nombre completo', type: 'Texto' },
  { label: 'Teléfono',        type: 'Teléfono' },
  { label: 'Email',           type: 'Email' },
  { label: 'Cédula',          type: 'Texto' },
]

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ── Drag-sortable field row ────────────────────────────────────────────────────

type FieldFormData = {
  field_label: string; field_name: string
  field_type:  string; placeholder: string; required: boolean
}

function SortableFieldRow({
  f, isEditing, editingData, setEditingData,
  savingField, onStartEdit, onCancelEdit, onSaveEdit, onDelete,
}: {
  f: FormFieldRow
  isEditing: boolean
  editingData: FieldFormData
  setEditingData: React.Dispatch<React.SetStateAction<FieldFormData>>
  savingField: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: f.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Editar campo</p>
        <div>
          <label className="text-xs font-medium text-slate-600">Etiqueta *</label>
          <input value={editingData.field_label}
            onChange={e => setEditingData(p => ({ ...p, field_label: e.target.value, field_name: toSlug(e.target.value) }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Tipo</label>
            <select value={editingData.field_type}
              onChange={e => setEditingData(p => ({ ...p, field_type: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Placeholder</label>
            <input value={editingData.placeholder}
              onChange={e => setEditingData(p => ({ ...p, placeholder: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="rounded border-slate-300 accent-blue-600"
            checked={editingData.required}
            onChange={e => setEditingData(p => ({ ...p, required: e.target.checked }))} />
          Campo requerido
        </label>
        <div className="flex gap-2 pt-1">
          <button disabled={savingField || !editingData.field_label.trim()} onClick={onSaveEdit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50">
            {savingField ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </button>
          <button onClick={onCancelEdit}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none rounded">
        <GripVertical className="h-4 w-4 text-slate-300" />
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-800">{f.field_label}</span>
      </div>
      <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        {FIELD_TYPES.find(t => t.value === f.field_type)?.label ?? f.field_type}
      </span>
      {f.required && (
        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
          Requerido
        </span>
      )}
      <button onClick={onStartEdit} className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-slate-200 hover:text-slate-600 transition">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={onDelete} className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Notification types ────────────────────────────────────────────────────────

interface NotificationRow {
  id?: string
  event_type: 'confirmation' | 'reminder' | 'cancellation' | 'reschedule'
  enabled: boolean
  to_patient: boolean
  to_clinic: boolean
  hours_before: number | null
}

const NOTIF_DEFAULTS: NotificationRow[] = [
  { event_type: 'confirmation',  enabled: true,  to_patient: true,  to_clinic: false, hours_before: null },
  { event_type: 'reminder',      enabled: false, to_patient: true,  to_clinic: false, hours_before: 24   },
  { event_type: 'cancellation',  enabled: false, to_patient: true,  to_clinic: false, hours_before: null },
  { event_type: 'reschedule',    enabled: false, to_patient: true,  to_clinic: false, hours_before: null },
]

const NOTIF_META: Record<string, { label: string; description: string }> = {
  confirmation: { label: 'Confirmación',    description: 'Se envía al paciente cuando agenda su cita' },
  reminder:     { label: 'Recordatorio',    description: 'Aviso previo a la cita' },
  cancellation: { label: 'Cancelación',     description: 'Se envía cuando se cancela la cita' },
  reschedule:   { label: 'Reagendamiento',  description: 'Se envía cuando se cambia la fecha/hora' },
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleMouseEnter() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 })
    }
    setShow(true)
  }

  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        ref={btnRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold hover:bg-slate-300 transition"
      >?</button>
      {show && (
        <div
          className="fixed w-56 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg z-[9999] -translate-x-1/2 -translate-y-full"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  )
}

export default function AppointmentTypesPage() {
  const [types,         setTypes]         = useState<AppointmentType[]>([])
  const [org,           setOrg]           = useState<OrgInfo | null>(null)
  const [doctors,       setDoctors]       = useState<DoctorOption[]>([])
  const [isLoading,     setIsLoading]     = useState(true)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editing,       setEditing]       = useState<AppointmentType | null>(null)
  const [form,          setForm]          = useState({ ...EMPTY_FORM })
  const [saving,        setSaving]        = useState(false)
  const [formError,     setFormError]     = useState<string | null>(null)
  const [copiedId,      setCopiedId]      = useState<string | null>(null)
  const [slugManual,    setSlugManual]    = useState(false)
  const [activeTab,     setActiveTab]     = useState<'general' | 'rules' | 'form'>('general')
  const [notifications, setNotifications] = useState<NotificationRow[]>(NOTIF_DEFAULTS)
  const [notifLoading,  setNotifLoading]  = useState(false)
  const [formFields,    setFormFields]    = useState<FormFieldRow[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [addingField,   setAddingField]   = useState(false)
  const [newField,      setNewField]      = useState({ ...EMPTY_FIELD })
  const [savingField,   setSavingField]   = useState(false)
  const [editingFieldId,   setEditingFieldId]   = useState<string | null>(null)
  const [editingFieldData, setEditingFieldData] = useState({ ...EMPTY_FIELD })

  const supabase = createClient()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = formFields.findIndex(f => f.id === active.id)
    const newIdx = formFields.findIndex(f => f.id === over.id)
    const reordered = arrayMove(formFields, oldIdx, newIdx)
    setFormFields(reordered)
    reordered.forEach((f, i) => {
      supabase.from('appointment_form_fields').update({ sort_order: i }).eq('id', f.id)
    })
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (member?.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, slug')
        .eq('id', member.organization_id)
        .single()
      if (orgData) setOrg({ id: orgData.id, slug: orgData.slug })

      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id, metadata')
        .eq('organization_id', member.organization_id)
        .eq('is_active', true)
      setDoctors(
        (doctorData ?? []).map((d: any) => ({
          id: d.id,
          name: String(d.metadata?.name ?? 'Médico sin nombre'),
        }))
      )
    }

    const { data } = await supabase
      .from('appointment_types')
      .select('*')
      .order('created_at', { ascending: true })

    setTypes(data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (activeTab !== 'form' || !editing) return
    setFieldsLoading(true)
    supabase
      .from('appointment_form_fields')
      .select('*')
      .eq('appointment_type_id', editing.id)
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => { setFormFields(data ?? []); setFieldsLoading(false) })
  }, [activeTab, editing?.id])


  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setSlugManual(false)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (t: AppointmentType) => {
    setEditing(t)
    setForm({
      name:             t.name,
      slug:             t.slug,
      duration_minutes: t.duration_minutes,
      color:            t.color,
      modality:         t.modality,
      price:            t.price != null ? String(t.price) : '',
      assignment_mode:  t.assignment_mode,
      doctor_ids:       t.doctor_ids ?? [],
      min_notice_hours:  t.min_notice_hours  ?? 24,
      max_notice_days:   t.max_notice_days   ?? 60,
      buffer_before_min: t.buffer_before_min ?? 0,
      buffer_after_min:  t.buffer_after_min  ?? 0,
      languages:         t.languages?.length ? t.languages : ['es'],
      rr_count_all:      t.rr_count_all ?? true,
    })
    setSlugManual(true)
    setFormError(null)
    setActiveTab('general')
    setNotifications(NOTIF_DEFAULTS)
    setModalOpen(true)
  }

  const handleNameChange = (name: string) => {
    setForm(p => ({
      ...p,
      name,
      slug: slugManual ? p.slug : toSlug(name),
    }))
  }

  const handleSlugChange = (slug: string) => {
    setSlugManual(true)
    setForm(p => ({ ...p, slug: toSlug(slug) }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.slug.trim()) { setFormError('El slug es obligatorio'); return }
    if (form.duration_minutes < 5) { setFormError('La duración mínima es 5 minutos'); return }

    setSaving(true)
    setFormError(null)

    const payload = {
      name:             form.name.trim(),
      slug:             form.slug.trim(),
      duration_minutes: Number(form.duration_minutes),
      color:            form.color,
      modality:         form.modality,
      price:            form.price ? Number(form.price) : null,
      assignment_mode:  form.assignment_mode,
      doctor_ids:       form.doctor_ids,
      min_notice_hours:  Number(form.min_notice_hours),
      max_notice_days:   Number(form.max_notice_days),
      buffer_before_min: Number(form.buffer_before_min),
      buffer_after_min:  Number(form.buffer_after_min),
      languages:         form.languages.length ? form.languages : ['es'],
      rr_count_all:      form.rr_count_all,
    }

    if (editing) {
      const { error } = await supabase
        .from('appointment_types')
        .update(payload)
        .eq('id', editing.id)
      if (error) {
        if (error.message.includes('appointment_types_organization_id_slug_key')) {
          setFormError('Ya existe un tipo de cita con ese nombre. Usa un nombre diferente.')
        } else {
          setFormError(error.message)
        }
        setSaving(false)
        return
      }
      // Upsert notifications for this type
      if (org && notifications.length > 0) {
        const notifRows = notifications.map(({ id, ...n }) => ({
          ...(id ? { id } : {}),
          organization_id:     org.id,
          appointment_type_id: editing.id,
          event_type:          n.event_type,
          enabled:             n.enabled,
          to_patient:          n.to_patient,
          to_clinic:           n.to_clinic,
          hours_before:        n.hours_before,
        }))
        await supabase
          .from('appointment_type_notifications')
          .upsert(notifRows, { onConflict: 'appointment_type_id,event_type' })
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: member } = await supabase
        .from('organization_members').select('organization_id').eq('user_id', user!.id).single()
      const { error } = await supabase
        .from('appointment_types')
        .insert({ ...payload, organization_id: member!.organization_id })
      if (error) {
        if (error.message.includes('appointment_types_organization_id_slug_key')) {
          setFormError('Ya existe un tipo de cita con ese nombre. Usa un nombre diferente.')
        } else {
          setFormError(error.message)
        }
        setSaving(false)
        return
      }
    }

    await loadData()
    setModalOpen(false)
    setSaving(false)
  }

  const toggleActive = async (t: AppointmentType) => {
    await supabase
      .from('appointment_types')
      .update({ active: !t.active })
      .eq('id', t.id)
    setTypes(prev => prev.map(x => x.id === t.id ? { ...x, active: !x.active } : x))
  }

  const copyLink = async (t: AppointmentType) => {
    if (!org) return
    const url = `${window.location.origin}/book/${org.slug}/${t.slug}`
    await navigator.clipboard.writeText(url)
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const publicLink = (t: AppointmentType) =>
    org ? `${window.location.origin}/book/${org.slug}/${t.slug}` : ''

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tipos de cita</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Crea tipos de reunión con link público propio para compartir.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Nuevo tipo
        </button>
      </div>

      {/* List */}
      {types.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <Link2 className="mx-auto h-8 w-8 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">Sin tipos de cita aún</p>
          <p className="mt-1 text-sm text-slate-400">
            Crea tu primer tipo para generar un link público de agendamiento.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> Crear tipo
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Duración</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Modalidad</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Precio</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Link público</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {types.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="font-medium text-slate-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{t.duration_minutes} min</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.modality === 'presencial'   ? 'bg-blue-100 text-blue-700' :
                      t.modality === 'virtual'      ? 'bg-emerald-100 text-emerald-700' :
                                                      'bg-slate-100 text-slate-600'
                    }`}>
                      {t.modality === 'presencial' ? 'Solo presencial' :
                       t.modality === 'virtual'    ? 'Solo virtual' :
                                                     'Paciente elige'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {t.price != null
                      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(t.price)
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="max-w-[200px] truncate text-xs text-slate-500 font-mono">
                        /book/{org?.slug}/{t.slug}
                      </span>
                      <button
                        onClick={() => copyLink(t)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title="Copiar link"
                      >
                        {copiedId === t.id
                          ? <Check className="h-4 w-4 text-emerald-500" />
                          : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => toggleActive(t)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        t.active ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        t.active ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => openEdit(t)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className={`relative z-10 flex w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
            editing ? 'max-h-[90vh] max-w-2xl' : 'max-h-[92vh] max-w-md'
          }`}>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? 'Editar tipo de cita' : 'Nuevo tipo de cita'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body — tabbed layout when editing, single column when creating */}
            {editing ? (
              <div className="flex flex-1 overflow-hidden">

                {/* Vertical tab sidebar */}
                <nav className="w-40 shrink-0 border-r border-slate-100 py-4 space-y-1 px-2">
                  {([
                    { id: 'general',       label: 'General',        Icon: Settings },
                    { id: 'rules',         label: 'Reglas',         Icon: Clock },
                    { id: 'form',          label: 'Formulario',     Icon: ClipboardList },
                  ] as const).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        activeTab === id
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </button>
                  ))}
                </nav>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                  {/* ── Tab: General ─────────────────────────────────────── */}
                  {activeTab === 'general' && (<>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre *</label>
                      <input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Ej: Consulta inicial"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Slug (URL) *</label>
                      <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500">
                        <span className="pl-3 text-sm text-slate-400 shrink-0">/book/{org?.slug}/</span>
                        <input value={form.slug} onChange={e => handleSlugChange(e.target.value)}
                          className="flex-1 bg-transparent px-1 py-2 text-sm focus:outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duración (min) *</label>
                        <input type="number" min={5} step={5} value={form.duration_minutes}
                          onChange={e => setForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Precio (opcional)</label>
                        <input type="number" min={0} value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                          placeholder="Sin precio"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    {/*
                     * Modality controls booking wizard behaviour:
                     * - 'presencial'     → skip modality step, always use presencial
                     * - 'virtual'        → skip modality step, always use virtual
                     * - 'patient_choice' → show Presencial/Virtual toggle in wizard step 1
                     */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modalidad del servicio *</label>
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        {([
                          { value: 'presencial',     label: 'Solo presencial' },
                          { value: 'virtual',        label: 'Solo virtual' },
                          { value: 'patient_choice', label: 'Paciente elige' },
                        ] as const).map(m => (
                          <button key={m.value} type="button" onClick={() => setForm(p => ({ ...p, modality: m.value }))}
                            className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${
                              form.modality === m.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Color</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PRESET_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                            className={`h-8 w-8 rounded-full transition ring-offset-2 ${form.color === c ? 'ring-2 ring-slate-700' : 'hover:scale-110'}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Modo de asignación *
                      </label>
                      <div className="mt-2 space-y-2">
                        {[
                          { assignment_mode: 'one_on_one',               rr_count_all: true,  label: 'El paciente decide',                   desc: 'El paciente siempre elige su médico. Sin excepción.' },
                          { assignment_mode: 'hybrid',                   rr_count_all: true,  label: 'Flexible',                             desc: 'El paciente puede elegir médico o dejarlo al sistema.' },
                          { assignment_mode: 'round_robin_proportional', rr_count_all: true,  label: 'Rotación automática — carga total',     desc: 'El sistema asigna al médico con menos citas, contando todas sus citas.' },
                          { assignment_mode: 'round_robin_proportional', rr_count_all: false, label: 'Rotación automática — solo automáticas', desc: 'El sistema asigna al médico con menos citas, contando solo las que él mismo asignó anteriormente.' },
                        ].map(opt => {
                          const isSelected = form.assignment_mode === opt.assignment_mode && form.rr_count_all === opt.rr_count_all
                          return (
                            <label key={opt.label}
                              className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                                isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                              }`}>
                              <input
                                type="radio"
                                name="assignment_mode_full"
                                checked={isSelected}
                                onChange={() => setForm(p => ({ ...p, assignment_mode: opt.assignment_mode as AssignmentMode, rr_count_all: opt.rr_count_all }))}
                                className="mt-0.5 shrink-0 accent-blue-600"
                              />
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Idiomas disponibles *</label>
                      <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' }].map(lang => (
                          <label key={lang.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                            <input type="checkbox" className="rounded border-slate-300 accent-blue-600"
                              checked={form.languages.includes(lang.value)}
                              onChange={e => setForm(p => ({
                                ...p,
                                languages: e.target.checked ? [...p.languages, lang.value]
                                  : p.languages.length > 1 ? p.languages.filter(l => l !== lang.value) : p.languages,
                              }))} />
                            {lang.label}
                          </label>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">Al menos un idioma debe estar seleccionado.</p>
                    </div>
                    {doctors.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Médicos asignados</label>
                        <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          {doctors.map(d => (
                            <label key={d.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                              <input type="checkbox" className="rounded border-slate-300 accent-blue-600"
                                checked={form.doctor_ids.includes(d.id)}
                                onChange={e => setForm(p => ({
                                  ...p,
                                  doctor_ids: e.target.checked ? [...p.doctor_ids, d.id] : p.doctor_ids.filter(id => id !== d.id),
                                }))} />
                              {d.name}
                            </label>
                          ))}
                        </div>
                        {form.doctor_ids.length === 0 && (
                          <p className="mt-1.5 text-xs text-slate-400">Sin médicos asignados — se usarán todos los activos.</p>
                        )}
                      </div>
                    )}
                  </>)}

                  {/* ── Tab: Reglas ──────────────────────────────────────── */}
                  {activeTab === 'rules' && (<>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aviso mínimo</label>
                      <p className="mt-0.5 text-xs text-slate-400">Mínimo de horas antes de que un paciente pueda agendar</p>
                      <input type="number" min={0} max={168} value={form.min_notice_hours}
                        onChange={e => setForm(p => ({ ...p, min_notice_hours: Number(e.target.value) }))}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aviso máximo</label>
                      <p className="mt-0.5 text-xs text-slate-400">Máximo de días en el futuro que un paciente puede agendar</p>
                      <input type="number" min={1} max={365} value={form.max_notice_days}
                        onChange={e => setForm(p => ({ ...p, max_notice_days: Number(e.target.value) }))}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Buffer antes de la cita</label>
                      <p className="mt-0.5 text-xs text-slate-400">Tiempo de preparación antes de cada cita</p>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="number" min={0} max={120} value={form.buffer_before_min}
                          onChange={e => setForm(p => ({ ...p, buffer_before_min: Number(e.target.value) }))}
                          className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <span className="text-sm text-slate-500">minutos</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Buffer después de la cita</label>
                      <p className="mt-0.5 text-xs text-slate-400">Tiempo de cierre después de cada cita</p>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="number" min={0} max={120} value={form.buffer_after_min}
                          onChange={e => setForm(p => ({ ...p, buffer_after_min: Number(e.target.value) }))}
                          className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <span className="text-sm text-slate-500">minutos</span>
                      </div>
                    </div>
                  </>)}

                  {/* ── Tab: Formulario ──────────────────────────────────── */}
                  {activeTab === 'form' && (
                    <div className="space-y-4">

                      {/* Base fields — always present, non-interactive */}
                      <div className="space-y-2">
                        <p className="text-xs text-slate-400">Campos base (siempre incluidos)</p>
                        {BASE_FIELDS.map(f => (
                          <div key={f.label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 opacity-60">
                            <GripVertical className="h-4 w-4 shrink-0 text-slate-200" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-slate-700">{f.label}</span>
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              {f.type}
                            </span>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                              Base
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Dynamic fields */}
                      {fieldsLoading ? (
                        <div className="flex items-center gap-2 py-4 text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Cargando campos...
                        </div>
                      ) : formFields.length === 0 && !addingField ? (
                        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-8 text-center">
                          <ClipboardList className="h-8 w-8 text-slate-300" />
                          <p className="text-sm text-slate-500">Sin campos personalizados</p>
                          <button
                            onClick={() => { setNewField({ ...EMPTY_FIELD }); setAddingField(true) }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                          >
                            <Plus className="h-3.5 w-3.5" /> Agregar campo
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Field list — drag-sortable */}
                          <div className="space-y-2">
                            <p className="text-xs text-slate-400">Campos adicionales</p>
                            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                              <SortableContext items={formFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                {formFields.map(f => (
                                  <SortableFieldRow
                                    key={f.id}
                                    f={f}
                                    isEditing={editingFieldId === f.id}
                                    editingData={editingFieldData}
                                    setEditingData={setEditingFieldData}
                                    savingField={savingField}
                                    onStartEdit={() => {
                                      setEditingFieldId(f.id)
                                      setEditingFieldData({ field_label: f.field_label, field_name: f.field_name, field_type: f.field_type, placeholder: f.placeholder ?? '', required: f.required })
                                      setAddingField(false)
                                    }}
                                    onCancelEdit={() => setEditingFieldId(null)}
                                    onSaveEdit={async () => {
                                      setSavingField(true)
                                      const { error } = await supabase
                                        .from('appointment_form_fields')
                                        .update({
                                          field_name:  editingFieldData.field_name || toSlug(editingFieldData.field_label),
                                          field_label: editingFieldData.field_label.trim(),
                                          field_type:  editingFieldData.field_type,
                                          placeholder: editingFieldData.placeholder.trim() || null,
                                          required:    editingFieldData.required,
                                        })
                                        .eq('id', f.id)
                                      setSavingField(false)
                                      if (!error) {
                                        setFormFields(prev => prev.map(x => x.id !== f.id ? x : {
                                          ...x,
                                          field_name:  editingFieldData.field_name || toSlug(editingFieldData.field_label),
                                          field_label: editingFieldData.field_label.trim(),
                                          field_type:  editingFieldData.field_type,
                                          placeholder: editingFieldData.placeholder.trim(),
                                          required:    editingFieldData.required,
                                        }))
                                        setEditingFieldId(null)
                                      }
                                    }}
                                    onDelete={async () => {
                                      await supabase.from('appointment_form_fields').update({ active: false }).eq('id', f.id)
                                      setFormFields(prev => prev.filter(x => x.id !== f.id))
                                    }}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          </div>

                          {/* Add field button (when list is non-empty and not adding) */}
                          {!addingField && (
                            <button
                              onClick={() => { setNewField({ ...EMPTY_FIELD }); setAddingField(true) }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                            >
                              <Plus className="h-3.5 w-3.5" /> Agregar campo
                            </button>
                          )}
                        </>
                      )}

                      {/* Inline add form */}
                      {addingField && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevo campo</p>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Etiqueta *</label>
                            <input
                              value={newField.field_label}
                              onChange={e => setNewField(p => ({
                                ...p,
                                field_label: e.target.value,
                                field_name:  toSlug(e.target.value),
                              }))}
                              placeholder="Ej: Número de seguro"
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-slate-600">Tipo</label>
                              <select
                                value={newField.field_type}
                                onChange={e => setNewField(p => ({ ...p, field_type: e.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-600">Placeholder</label>
                              <input
                                value={newField.placeholder}
                                onChange={e => setNewField(p => ({ ...p, placeholder: e.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 accent-blue-600"
                              checked={newField.required}
                              onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))}
                            />
                            Campo requerido
                          </label>
                          <div className="flex gap-2 pt-1">
                            <button
                              disabled={savingField || !newField.field_label.trim()}
                              onClick={async () => {
                                if (!editing || !org) return
                                setSavingField(true)
                                const { data, error } = await supabase
                                  .from('appointment_form_fields')
                                  .insert({
                                    organization_id:     org.id,
                                    appointment_type_id: editing.id,
                                    field_name:          newField.field_name || toSlug(newField.field_label),
                                    field_label:         newField.field_label.trim(),
                                    field_type:          newField.field_type,
                                    placeholder:         newField.placeholder.trim() || null,
                                    required:            newField.required,
                                    sort_order:          formFields.length,
                                    active:              true,
                                  })
                                  .select()
                                  .single()
                                setSavingField(false)
                                if (!error && data) {
                                  setFormFields(prev => [...prev, data as FormFieldRow])
                                  setAddingField(false)
                                  setNewField({ ...EMPTY_FIELD })
                                }
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                            >
                              {savingField ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              Guardar
                            </button>
                            <button
                              onClick={() => { setAddingField(false); setNewField({ ...EMPTY_FIELD }) }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {formError && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
                  )}
                </div>
              </div>
            ) : (
              /* Single-column body for create flow */
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre *</label>
                <input
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="Ej: Consulta inicial"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Slug (URL) *</label>
                <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="pl-3 text-sm text-slate-400 shrink-0">/book/{org?.slug}/</span>
                  <input
                    value={form.slug}
                    onChange={e => handleSlugChange(e.target.value)}
                    className="flex-1 bg-transparent px-1 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duración (min) *</label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={form.duration_minutes}
                    onChange={e => setForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Precio (opcional)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="Sin precio"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/*
               * Modality controls booking wizard behaviour (not yet implemented):
               * - 'presencial'     → skip modality step, always use presencial
               * - 'virtual'        → skip modality step, always use virtual
               * - 'patient_choice' → show Presencial/Virtual toggle in wizard step 1
               */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modalidad del servicio *</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {([
                    { value: 'presencial',     label: 'Solo presencial' },
                    { value: 'virtual',        label: 'Solo virtual' },
                    { value: 'patient_choice', label: 'Paciente elige' },
                  ] as const).map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, modality: m.value }))}
                      className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${
                        form.modality === m.value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Color</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, color: c }))}
                      className={`h-8 w-8 rounded-full transition ring-offset-2 ${
                        form.color === c ? 'ring-2 ring-slate-700' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Assignment mode */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Modo de asignación *
                </label>
                <div className="mt-2 space-y-2">
                  {[
                    { assignment_mode: 'one_on_one',               rr_count_all: true,  label: 'El paciente decide',                   desc: 'El paciente siempre elige su médico. Sin excepción.' },
                    { assignment_mode: 'hybrid',                   rr_count_all: true,  label: 'Flexible',                             desc: 'El paciente puede elegir médico o dejarlo al sistema.' },
                    { assignment_mode: 'round_robin_proportional', rr_count_all: true,  label: 'Rotación automática — carga total',     desc: 'El sistema asigna al médico con menos citas, contando todas sus citas.' },
                    { assignment_mode: 'round_robin_proportional', rr_count_all: false, label: 'Rotación automática — solo automáticas', desc: 'El sistema asigna al médico con menos citas, contando solo las que él mismo asignó anteriormente.' },
                  ].map(opt => {
                    const isSelected = form.assignment_mode === opt.assignment_mode && form.rr_count_all === opt.rr_count_all
                    return (
                      <label key={opt.label}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                          isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}>
                        <input
                          type="radio"
                          name="assignment_mode_full"
                          checked={isSelected}
                          onChange={() => setForm(p => ({ ...p, assignment_mode: opt.assignment_mode as AssignmentMode, rr_count_all: opt.rr_count_all }))}
                          className="mt-0.5 shrink-0 accent-blue-600"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Min notice hours */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aviso mínimo (horas) *</label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={form.min_notice_hours}
                  onChange={e => setForm(p => ({ ...p, min_notice_hours: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Languages */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Idiomas disponibles *</label>
                <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {[
                    { value: 'es', label: 'Español' },
                    { value: 'en', label: 'English' },
                    { value: 'pt', label: 'Português' },
                  ].map(lang => (
                    <label key={lang.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 accent-blue-600"
                        checked={form.languages.includes(lang.value)}
                        onChange={e => setForm(p => ({
                          ...p,
                          languages: e.target.checked
                            ? [...p.languages, lang.value]
                            : p.languages.length > 1
                              ? p.languages.filter(l => l !== lang.value)
                              : p.languages, // prevent deselecting last
                        }))}
                      />
                      {lang.label}
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">Al menos un idioma debe estar seleccionado.</p>
              </div>

              {/* Doctor selection */}
              {doctors.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Médicos asignados</label>
                  <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {doctors.map(d => (
                      <label key={d.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 accent-blue-600"
                          checked={form.doctor_ids.includes(d.id)}
                          onChange={e => setForm(p => ({
                            ...p,
                            doctor_ids: e.target.checked
                              ? [...p.doctor_ids, d.id]
                              : p.doctor_ids.filter(id => id !== d.id),
                          }))}
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                  {form.doctor_ids.length === 0 && (
                    <p className="mt-1.5 text-xs text-slate-400">Sin médicos asignados — se usarán todos los activos.</p>
                  )}
                </div>
              )}

              {formError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
              )}
            </div>
            )}

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editing ? 'Guardar cambios' : 'Crear tipo'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
