'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Copy, Check, Loader2, Pencil, Link2, X, Save, Settings, Clock, ClipboardList } from 'lucide-react'

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
  { value: 'hybrid',                    label: 'Híbrido (paciente puede escoger médico)' },
  { value: 'one_on_one',                label: 'One-on-One (paciente escoge médico)' },
  { value: 'round_robin_proportional',  label: 'Round Robin — Proporcional (menos citas)' },
  { value: 'round_robin_availability',  label: 'Round Robin — Disponibilidad (primer disponible)' },
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
}

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

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, slug')
        .eq('id', profile.organization_id)
        .single()
      if (orgData) setOrg({ id: orgData.id, slug: orgData.slug })

      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id, metadata')
        .eq('organization_id', profile.organization_id)
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
    })
    setSlugManual(true)
    setFormError(null)
    setActiveTab('general')
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
    }

    if (editing) {
      const { error } = await supabase
        .from('appointment_types')
        .update(payload)
        .eq('id', editing.id)
      if (error) { setFormError(error.message); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('users').select('organization_id').eq('id', user!.id).single()
      const { error } = await supabase
        .from('appointment_types')
        .insert({ ...payload, organization_id: profile!.organization_id })
      if (error) { setFormError(error.message); setSaving(false); return }
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
                    { id: 'general',    label: 'General',    Icon: Settings },
                    { id: 'rules',      label: 'Reglas',     Icon: Clock },
                    { id: 'form',       label: 'Formulario', Icon: ClipboardList },
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
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modo de asignación *</label>
                      <select value={form.assignment_mode} onChange={e => setForm(p => ({ ...p, assignment_mode: e.target.value as AssignmentMode }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {ASSIGNMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
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
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <ClipboardList className="h-10 w-10 text-slate-300 mb-3" />
                      <p className="text-sm font-medium text-slate-600">Configuración del formulario del paciente</p>
                      <p className="mt-1 text-xs text-slate-400">Próximamente</p>
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
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modo de asignación *</label>
                <select
                  value={form.assignment_mode}
                  onChange={e => setForm(p => ({ ...p, assignment_mode: e.target.value as AssignmentMode }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ASSIGNMENT_MODES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
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
