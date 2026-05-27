'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Loader2, Pencil, X, Save, Stethoscope, Trash2 } from 'lucide-react'

interface Procedure {
  id: string
  name: string
  price: number
  is_active: boolean
  created_at: string
}

const EMPTY_FORM = { name: '', price: '' }

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n)
}

export default function ProceduresPage() {
  const [procedures, setProcedures]   = useState<Procedure[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Procedure | null>(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [isActive, setIsActive]       = useState(true)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/procedures')
    if (res.ok) {
      const data = await res.json()
      setProcedures(data)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setIsActive(true)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(p: Procedure) {
    setEditing(p)
    setForm({ name: p.name, price: String(p.price) })
    setIsActive(p.is_active)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) {
      setFormError('Ingresa un precio válido'); return
    }

    setSaving(true)
    setFormError(null)

    if (editing) {
      const res = await fetch('/api/procedures', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, name: form.name, price: Number(form.price), is_active: isActive }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Error guardando'); setSaving(false); return }
      setProcedures(prev => prev.map(p => p.id === editing.id ? data : p))
    } else {
      const res = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, price: Number(form.price) }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Error creando'); setSaving(false); return }
      setProcedures(prev => [...prev, data])
    }

    setSaving(false)
    setModalOpen(false)
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm('¿Eliminar este procedimiento? Esta acción no se puede deshacer.')) return

    const res = await fetch('/api/procedures', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id }),
    })
    if (res.ok) {
      setProcedures(prev => prev.filter(p => p.id !== editing.id))
      setModalOpen(false)
    }
  }

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
          <h2 className="text-lg font-bold text-slate-900">Procedimientos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Catálogo de procedimientos con precio de referencia.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Nuevo procedimiento
        </button>
      </div>

      {/* List */}
      {procedures.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <Stethoscope className="mx-auto h-8 w-8 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">Sin procedimientos aún</p>
          <p className="mt-1 text-sm text-slate-400">
            Agrega los procedimientos que ofrece tu clínica con su precio de referencia.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> Crear procedimiento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {procedures.map(p => (
            <div
              key={p.id}
              onClick={() => openEdit(p)}
              className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                  <p className="mt-1 text-base font-bold text-emerald-700">{formatCOP(p.price)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    p.is_active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(p) }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 flex w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[90vh] max-w-md">

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? 'Editar procedimiento' : 'Nuevo procedimiento'}
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
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Consulta de seguimiento"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Precio (COP) *</label>
                <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="pl-3 text-sm text-slate-400 shrink-0">$</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="350000"
                    className="flex-1 bg-transparent px-2 py-2 text-sm focus:outline-none"
                  />
                </div>
                {form.price && !isNaN(Number(form.price)) && Number(form.price) > 0 && (
                  <p className="mt-1 text-xs text-slate-400">{formatCOP(Number(form.price))}</p>
                )}
              </div>

              {editing && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</label>
                  <button
                    type="button"
                    onClick={() => setIsActive(v => !v)}
                    className={`mt-2 flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </div>
                    {isActive ? 'Activo — visible en el catálogo' : 'Inactivo — oculto del catálogo'}
                  </button>
                </div>
              )}

              {formError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
              )}

              {/* Danger zone — edit only */}
              {editing && (
                <div className="border-t border-slate-200 pt-4 mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-3">Zona de peligro</p>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-red-100 transition flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar procedimiento
                  </button>
                </div>
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
                {editing ? 'Guardar cambios' : 'Crear procedimiento'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
