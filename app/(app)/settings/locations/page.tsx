'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Loader2, Pencil, Plus, Save, X } from 'lucide-react'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // client-side uses anon; RLS-safe reads
)

// Use service role only for mutations via a server action pattern is ideal,
// but here we use the user-scoped client for all queries (RLS enforces org scope).

interface Location {
  id: string
  organization_id: string
  name: string
  address: string | null
  is_active: boolean
}

const B = {
  primary: '#215F73',
  fg:      '#0D2B3E',
  muted:   '#4A6B7A',
  bg:      '#EBF0F6',
  border:  '#C8D8E4',
  card:    '#FFFFFF',
  sec:     '#F3F7FA',
}

const EMPTY = { name: '', address: '', is_active: true }

export default function LocationsPage() {
  const supabase = createClient()

  const [locations,    setLocations]    = useState<Location[]>([])
  const [orgId,        setOrgId]        = useState<string | null>(null)
  const [isLoading,    setIsLoading]    = useState(true)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editing,      setEditing]      = useState<Location | null>(null)
  const [form,         setForm]         = useState(EMPTY)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [toast,        setToast]        = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }
    const { data: userRecord } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    const oid = userRecord?.organization_id ?? null
    setOrgId(oid)
    if (oid) {
      const { data } = await supabase.from('locations').select('*').eq('organization_id', oid).order('name')
      setLocations((data ?? []) as Location[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (loc: Location) => {
    setEditing(loc)
    setForm({ name: loc.name, address: loc.address ?? '', is_active: loc.is_active })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.address.trim()) { setFormError('La dirección es obligatoria'); return }
    if (!orgId) return
    setSaving(true)
    setFormError(null)
    const payload = { name: form.name.trim(), address: form.address.trim(), is_active: form.is_active }
    if (editing) {
      const { error } = await supabase.from('locations').update(payload).eq('id', editing.id)
      if (error) { setFormError(error.message); setSaving(false); return }
      showToast('Sede actualizada')
    } else {
      const { error } = await supabase.from('locations').insert({ ...payload, organization_id: orgId })
      if (error) { setFormError(error.message); setSaving(false); return }
      showToast('Sede creada')
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  const toggleActive = async (loc: Location) => {
    await supabase.from('locations').update({ is_active: !loc.is_active }).eq('id', loc.id)
    setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, is_active: !l.is_active } : l))
    showToast(loc.is_active ? 'Sede desactivada' : 'Sede activada')
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: B.fg }}>Sedes</h2>
          <p className="text-sm mt-0.5" style={{ color: B.muted }}>Gestiona las sedes de atención de tu clínica.</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
          style={{ background: B.primary }}>
          <Plus className="h-4 w-4" /> Nueva sede
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-12 justify-center" style={{ color: B.muted }}>
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
        </div>
      ) : locations.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed py-16 text-center" style={{ borderColor: B.border }}>
          <p className="font-semibold" style={{ color: B.fg }}>Sin sedes registradas</p>
          <p className="mt-1 text-sm" style={{ color: B.muted }}>Crea la primera sede para tu organización.</p>
          <button onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ background: B.primary }}>
            <Plus className="h-4 w-4" /> Nueva sede
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border overflow-hidden" style={{ borderColor: B.border }}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: B.border, background: B.sec }}>
                {['Nombre', 'Dirección', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: B.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => (
                <tr key={loc.id} className="border-b last:border-0 transition" style={{ borderColor: B.border }}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: B.fg }}>{loc.name}</td>
                  <td className="px-5 py-3.5 max-w-[280px] truncate" style={{ color: B.muted }}>{loc.address || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={loc.is_active
                        ? { background: '#E1F5EE', color: '#0F6E56' }
                        : { background: '#E2EAF0', color: B.muted }}>
                      {loc.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(loc)}
                        className="rounded-lg p-1.5 transition hover:opacity-70"
                        style={{ color: B.muted }}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleActive(loc)}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                        style={{ background: loc.is_active ? B.primary : B.border }}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${loc.is_active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: B.border }}>
              <h3 className="text-base font-semibold" style={{ color: B.fg }}>
                {editing ? 'Editar sede' : 'Nueva sede'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ color: B.muted }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: B.muted }}>Nombre *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Sede Principal"
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ border: `1px solid ${B.border}`, background: B.sec, color: B.fg }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: B.muted }}>Dirección *</label>
                <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Calle 10 #43-55, El Poblado, Medellín"
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ border: `1px solid ${B.border}`, background: B.sec, color: B.fg }} />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  style={{ background: form.is_active ? B.primary : B.border }}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm" style={{ color: B.fg }}>Sede activa</span>
              </label>
              {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4" style={{ borderColor: B.border }}>
              <button onClick={() => setModalOpen(false)} disabled={saving}
                className="rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                style={{ borderColor: B.border, color: B.fg }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: B.primary }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl px-5 py-3 text-sm font-medium text-white shadow-lg"
          style={{ background: B.primary }}>
          {toast}
        </div>
      )}
    </div>
  )
}
