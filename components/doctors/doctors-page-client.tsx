'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, Pencil } from 'lucide-react'

type DoctorRow = {
  id: string
  specialty: string | null
  is_active: boolean
  metadata: Record<string, unknown> | null
  google_calendar_connected_at: string | null
  google_calendar_id: string | null
}

type ScheduleRow = { doctor_id: string; day_of_week: number }

const DAY_ABBR: Record<number, string> = {
  1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom',
}

const EMPTY_FORM = { name: '', specialty: '', duration: '30', color: '#2563eb', active: true }

export function DoctorsPageClient() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Read Google OAuth result from URL and show toast
  useEffect(() => {
    const success = searchParams.get('google_success')
    const error   = searchParams.get('google_error')
    if (success === 'true') {
      setToast({ msg: 'Google Calendar conectado exitosamente', type: 'success' })
      router.replace('/doctors')
    } else if (error === 'true') {
      setToast({ msg: 'Error conectando Google Calendar', type: 'error' })
      router.replace('/doctors')
    }
  }, [searchParams])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const fetchData = async () => {
    setLoading(true)
    setPageError(null)
    const { data: doctorData, error: dErr } = await supabase
      .from('doctors')
      .select('id, specialty, is_active, metadata, google_calendar_connected_at, google_calendar_id')
      .order('created_at', { ascending: true })
    if (dErr) { setPageError(dErr.message); setLoading(false); return }

    const ids = (doctorData ?? []).map((d: DoctorRow) => d.id)
    const { data: scheduleData } = ids.length
      ? await supabase.from('schedules').select('doctor_id, day_of_week').in('doctor_id', ids)
      : { data: [] }

    setDoctors((doctorData as DoctorRow[]) ?? [])
    setSchedules((scheduleData as ScheduleRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const getDays = (doctorId: string) => {
    const days = [
      ...new Set(schedules.filter(s => s.doctor_id === doctorId).map(s => s.day_of_week)),
    ].sort((a, b) => a - b)
    return days.length ? days.map(d => DAY_ABBR[d] ?? d).join(', ') : '—'
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (doc: DoctorRow) => {
    setEditingId(doc.id)
    setForm({
      name: (doc.metadata?.name as string) ?? '',
      specialty: doc.specialty ?? '',
      duration: String((doc.metadata?.default_duration as number) ?? 30),
      color: (doc.metadata?.calendar_color as string) ?? '#2563eb',
      active: doc.is_active,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setFormError(null) }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('El nombre es requerido.'); return }
    setSaving(true)
    setFormError(null)

    const payload = {
      specialty: form.specialty.trim() || null,
      is_active: form.active,
      metadata: {
        name: form.name.trim(),
        calendar_color: form.color,
        default_duration: Number(form.duration) || 30,
      },
    }

    if (editingId) {
      const { error } = await supabase.from('doctors').update(payload).eq('id', editingId)
      if (error) { setFormError(error.message); setSaving(false); return }
    } else {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('doctors').insert({
        user_id: auth.user?.id,
        ...payload,
      })
      if (error) { setFormError(error.message); setSaving(false); return }
    }

    setSaving(false)
    closeModal()
    await fetchData()
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('doctors').update({ is_active: !current }).eq('id', id)
    await fetchData()
  }

  const handleConnect = (doctorId: string) => {
    window.location.href = `/api/google/auth?doctor_id=${doctorId}`
  }

  const handleDisconnect = async (doctorId: string) => {
    setDisconnecting(doctorId)
    try {
      await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: doctorId }),
      })
      await fetchData()
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Médicos registrados</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {loading ? '…' : `${doctors.length} médico${doctors.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Nuevo médico
          </button>
        </div>

        {/* Table body */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando médicos...</span>
            </div>
          ) : pageError ? (
            <p className="px-6 py-10 text-sm text-red-600">{pageError}</p>
          ) : doctors.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-slate-400">No hay médicos registrados.</p>
              <button onClick={openCreate} className="mt-3 text-sm font-medium text-blue-600 hover:underline">
                Crear el primero
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Especialidad</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Duración</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Días que atiende</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Google Calendar</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {doctors.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: (doc.metadata?.calendar_color as string) ?? '#2563eb' }}
                        />
                        <span className="font-medium text-slate-900">
                          {(doc.metadata?.name as string) ?? 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{doc.specialty ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {(doc.metadata?.default_duration as number) ?? 30} min
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">{getDays(doc.id)}</td>
                    <td className="px-6 py-4">
                      <span className={[
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        doc.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500',
                      ].join(' ')}>
                        {doc.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {doc.google_calendar_connected_at ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            ✓ Conectado
                          </span>
                          <button
                            onClick={() => handleDisconnect(doc.id)}
                            disabled={disconnecting === doc.id}
                            className="text-xs font-medium text-red-500 hover:text-red-700 transition disabled:opacity-50"
                          >
                            {disconnecting === doc.id ? 'Desconectando…' : 'Desconectar'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConnect(doc.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Conectar
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(doc)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
                        >
                          <Pencil className="h-3 w-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => toggleActive(doc.id, doc.is_active)}
                          className={[
                            'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                            doc.is_active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                          ].join(' ')}
                        >
                          {doc.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Doctor modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Editar médico' : 'Nuevo médico'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Dra. Ana Martínez"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Especialidad
                </label>
                <input
                  value={form.specialty}
                  onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}
                  placeholder="Ej: Medicina General"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Duración (min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={form.duration}
                    onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Color calendario
                  </label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    className="mt-1.5 h-[42px] w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5"
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span className="text-sm text-slate-700">Activo en agenda pública</span>
              </label>
              {formError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Guardar cambios' : 'Crear médico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-2xl px-5 py-3 text-sm text-white shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
