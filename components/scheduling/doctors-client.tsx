'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, Plus, Save, ShieldCheck, XCircle } from 'lucide-react'

interface DoctorRecord {
  id: string
  user_id: string
  specialty: string | null
  is_active: boolean
  metadata: Record<string, any> | null
}

const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function DoctorsClient() {
  const [doctors, setDoctors] = useState<DoctorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    id: '',
    name: '',
    specialty: '',
    color: '#2563eb',
    duration: '30',
    active: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchDoctors = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('doctors')
        .select('id, user_id, specialty, is_active, metadata')
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setDoctors((data as DoctorRecord[]) || [])
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar los médicos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        setError('No se encontró usuario activo.')
        return
      }
      setCurrentUserId(data.user.id)
      await fetchDoctors()
    }
    load()
  }, [])

  const handleInput = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleEdit = (doctor: DoctorRecord) => {
    setForm({
      id: doctor.id,
      name: doctor.metadata?.name || '',
      specialty: doctor.specialty || '',
      color: doctor.metadata?.calendar_color || '#2563eb',
      duration: String(doctor.metadata?.default_duration || 30),
      active: doctor.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    if (!form.name || !currentUserId) {
      setError('Nombre del médico y usuario activo son requeridos.')
      return
    }

    setIsSaving(true)
    setError(null)

    const payload = {
      specialty: form.specialty || null,
      is_active: form.active,
      metadata: {
        name: form.name,
        calendar_color: form.color,
        default_duration: Number(form.duration) || 30,
      },
    }

    try {
      if (form.id) {
        const { error: updateError } = await supabase
          .from('doctors')
          .update(payload)
          .eq('id', form.id)
        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const { error: insertError } = await supabase.from('doctors').insert({
          user_id: currentUserId,
          specialty: payload.specialty,
          is_active: payload.is_active,
          metadata: payload.metadata,
        })
        if (insertError) {
          setError(insertError.message)
          return
        }
      }

      setForm({ id: '', name: '', specialty: '', color: '#2563eb', duration: '30', active: true })
      await fetchDoctors()
    } catch (err) {
      console.error(err)
      setError('Error guardando médico.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await supabase.from('doctors').update({ is_active: !active }).eq('id', id)
      await fetchDoctors()
    } catch (err) {
      console.error(err)
      setError('Error actualizando estado del médico.')
    }
  }

  const doctorLabel = useMemo(
    () => (doctor: DoctorRecord) => doctor.metadata?.name || 'Médico sin nombre',
    []
  )

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Crear / editar médico</h2>
            <p className="mt-2 text-sm text-slate-600">Agrega médicos y configura su color y duración por defecto.</p>
          </div>
          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={form.name}
                onChange={(event) => handleInput('name', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Especialidad</label>
              <input
                value={form.specialty}
                onChange={(event) => handleInput('specialty', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Color calendario</label>
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => handleInput('color', event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-300 bg-white p-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Duración (min)</label>
                <input
                  type="number"
                  value={form.duration}
                  onChange={(event) => handleInput('duration', event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="active"
                type="checkbox"
                checked={form.active}
                onChange={(event) => handleInput('active', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <label htmlFor="active" className="text-sm text-slate-700">Activo</label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {form.id ? 'Actualizar médico' : 'Crear médico'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Médicos registrados</h2>
            <p className="mt-1 text-sm text-slate-600">Edita o desactiva los médicos que aparecen en la agenda.</p>
          </div>
          <button
            onClick={() => setForm({ id: '', name: '', specialty: '', color: '#2563eb', duration: '30', active: true })}
            className="inline-flex items-center gap-2 rounded-3xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            <Plus className="h-4 w-4" />
            Nuevo médico
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Especialidad</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Cargando médicos...
                  </td>
                </tr>
              ) : doctors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No hay médicos registrados.
                  </td>
                </tr>
              ) : (
                doctors.map((doctor) => {
                  const name = doctorLabel(doctor)
                  return (
                    <tr key={doctor.id} className="border-b border-slate-200">
                      <td className="px-4 py-4 font-medium text-slate-900">{name}</td>
                      <td className="px-4 py-4 text-slate-600">{doctor.specialty || 'General'}</td>
                      <td className="px-4 py-4 text-slate-600">{doctor.metadata?.default_duration || 30} min</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${doctor.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {doctor.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleEdit(doctor)}
                            className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => toggleActive(doctor.id, doctor.is_active)}
                            className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${doctor.is_active ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                          >
                            {doctor.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
