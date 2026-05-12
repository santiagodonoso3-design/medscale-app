'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, Pencil, MoreHorizontal } from 'lucide-react'

type DoctorRow = {
  id: string
  specialty: string | null
  is_active: boolean
  metadata: Record<string, unknown> | null
}

type ScheduleRow = { doctor_id: string; day_of_week: number }

const DAY_ABBR: Record<number, string> = {
  1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom',
}

const EMPTY_FORM = { name: '', specialty: '', duration: '30', color: '#2563eb', active: true }

interface DoctorsPageClientProps {
  isDoctor?: boolean
  userDoctorId?: string | null
}

export function DoctorsPageClient({ isDoctor = false, userDoctorId = null }: DoctorsPageClientProps) {
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteChecking, setDeleteChecking] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [openMenuDoc, setOpenMenuDoc] = useState<DoctorRow | null>(null)

  function toggleMenu(doc: DoctorRow, e: React.MouseEvent<HTMLButtonElement>) {
    if (openMenuId === doc.id) {
      setOpenMenuId(null)
      setOpenMenuDoc(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const menuHeight = 140
    const spaceBelow = window.innerHeight - rect.bottom
    setMenuPos({
      top: spaceBelow > menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4,
      left: rect.right - 176,
    })
    setOpenMenuId(doc.id)
    setOpenMenuDoc(doc)
  }

  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    setPageError(null)
    const { data: doctorData, error: dErr } = await supabase
      .from('doctors')
      .select('id, specialty, is_active, metadata')
      .order('created_at', { ascending: true })
    if (dErr) { setPageError(dErr.message); setLoading(false); return }

    const ids = (doctorData ?? []).map((d: DoctorRow) => d.id)
    const { data: scheduleData } = ids.length
      ? await supabase.from('schedules').select('doctor_id, day_of_week').in('doctor_id', ids)
      : { data: [] }

    let filteredDoctors = (doctorData as DoctorRow[]) ?? []
    if (isDoctor && userDoctorId) {
      filteredDoctors = filteredDoctors.filter(d => d.id === userDoctorId)
    }
    setDoctors(filteredDoctors)
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

  const handleDelete = async (doctorId: string) => {
    setDeleteChecking(true)
    setDeleteError(null)
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .in('status', ['scheduled', 'confirmed'])
    if (count && count > 0) {
      setDeleteError(`No se puede eliminar: tiene ${count} cita(s) activa(s).`)
      setDeleteChecking(false)
      return
    }
    await supabase.from('schedules').delete().eq('doctor_id', doctorId)
    await supabase.from('organization_members').delete().eq('doctor_id', doctorId)
    await supabase.from('doctors').delete().eq('id', doctorId)
    setDeleteConfirmId(null)
    setDeleteChecking(false)
    await fetchData()
  }


  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-visible">
        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Médicos registrados</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {loading ? '…' : `${doctors.length} médico${doctors.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {!isDoctor && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Nuevo médico
            </button>
          )}
        </div>

        {/* Table body */}
        <div className="overflow-x-auto overflow-y-visible">
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
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {getDays(doc.id) === '—' ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-amber-500 font-medium">⚠️ Sin disponibilidad</span>
                          <a href="/doctors/availability" className="text-xs text-blue-500 hover:underline ml-1">
                            Configurar →
                          </a>
                        </span>
                      ) : getDays(doc.id)}
                    </td>
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
                      <div className="flex justify-end">
                        <button
                          onClick={e => toggleMenu(doc, e)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        >
                          <MoreHorizontal className="h-4 w-4" />
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

      {/* ── Doctor action menu (fixed portal) ───────────────────────── */}
      {openMenuId && openMenuDoc && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpenMenuId(null); setOpenMenuDoc(null) }} />
          <div
            className="fixed z-50 w-44 rounded-2xl border border-slate-100 bg-white shadow-lg py-1.5"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              onClick={() => { openEdit(openMenuDoc); setOpenMenuId(null); setOpenMenuDoc(null) }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Pencil className="h-3.5 w-3.5 text-slate-400" />
              Editar
            </button>
            {!isDoctor && (
              <button
                onClick={() => { toggleActive(openMenuDoc.id, openMenuDoc.is_active); setOpenMenuId(null); setOpenMenuDoc(null) }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                <span className={`h-3.5 w-3.5 rounded-full border-2 ${openMenuDoc.is_active ? 'border-amber-400' : 'border-emerald-400'}`} />
                {openMenuDoc.is_active ? 'Desactivar' : 'Activar'}
              </button>
            )}
            {!isDoctor && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => { setDeleteConfirmId(openMenuDoc.id); setDeleteError(null); setOpenMenuId(null); setOpenMenuDoc(null) }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <X className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Delete confirm modal ──────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setDeleteConfirmId(null); setDeleteError(null) }} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">¿Eliminar médico?</h2>
            <p className="text-sm text-slate-500">Esta acción eliminará el médico, su disponibilidad y su acceso al sistema. No se puede deshacer.</p>
            {deleteError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setDeleteConfirmId(null); setDeleteError(null) }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteChecking}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleteChecking && <Loader2 className="h-4 w-4 animate-spin" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

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

    </>
  )
}
