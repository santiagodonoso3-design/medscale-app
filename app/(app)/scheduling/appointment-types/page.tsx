'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Copy, Check, Loader2, Pencil, Link2, X, Save } from 'lucide-react'

type AssignmentMode = 'one_on_one' | 'round_robin_proportional' | 'round_robin_availability' | 'hybrid'

interface AppointmentType {
  id: string
  name: string
  slug: string
  duration_minutes: number
  color: string
  modality: 'presencial' | 'virtual'
  price: number | null
  active: boolean
  assignment_mode: AssignmentMode
  doctor_ids: string[]
  min_notice_hours: number
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
  modality: 'presencial' as 'presencial' | 'virtual',
  price: '',
  assignment_mode: 'hybrid' as AssignmentMode,
  doctor_ids: [] as string[],
  min_notice_hours: 24,
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
      min_notice_hours: t.min_notice_hours ?? 24,
    })
    setSlugManual(true)
    setFormError(null)
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
      min_notice_hours: Number(form.min_notice_hours),
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
                      t.modality === 'presencial'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {t.modality === 'presencial' ? 'Presencial' : 'Virtual'}
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
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? 'Editar tipo de cita' : 'Nuevo tipo de cita'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
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

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modalidad *</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(['presencial', 'virtual'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, modality: m }))}
                      className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition capitalize ${
                        form.modality === m
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {m === 'presencial' ? 'Presencial' : 'Virtual'}
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
