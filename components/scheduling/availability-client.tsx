'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Check, Clock4, House } from 'lucide-react'

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function AvailabilityClient() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    doctor_id: '',
    location_id: '',
    room_id: '',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '17:00',
    is_recurring: true,
    active: true,
    notes: '',
  })

  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: doctorData, error: doctorError }, { data: locationData, error: locationError }, { data: roomData, error: roomError }, { data: scheduleData, error: scheduleError }] = await Promise.all([
        supabase.from('doctors').select('id, specialty, is_active, metadata').order('created_at', { ascending: true }),
        supabase.from('locations').select('id, name').order('name', { ascending: true }),
        supabase.from('locations_rooms').select('id, name, location_id').order('name', { ascending: true }),
        supabase
          .from('schedules')
          .select('id, doctor_id, location_id, room_id, day_of_week, start_time, end_time, is_recurring, active, notes')
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true }),
      ])

      if (doctorError || locationError || roomError || scheduleError) {
        throw new Error(doctorError?.message || locationError?.message || roomError?.message || scheduleError?.message || 'Error cargando datos')
      }

      setDoctors(doctorData || [])
      setLocations(locationData || [])
      setRooms(roomData || [])
      setSchedules(scheduleData || [])
      if (!form.doctor_id && doctorData?.length) {
        setForm((prev) => ({ ...prev, doctor_id: doctorData[0].id }))
      }
      if (!form.location_id && locationData?.length) {
        setForm((prev) => ({ ...prev, location_id: locationData[0].id }))
      }
      if (!form.room_id && roomData?.length) {
        setForm((prev) => ({ ...prev, room_id: roomData[0].id }))
      }
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar las disponibilidades.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSave = async () => {
    if (!form.doctor_id || !form.location_id || !form.room_id) {
      setError('Selecciona médico, sede y consultorio.')
      return
    }

    setError(null)
    try {
      const { error } = await supabase.from('schedules').insert({
        doctor_id: form.doctor_id,
        location_id: form.location_id,
        room_id: form.room_id,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        is_recurring: form.is_recurring,
        active: form.active,
        notes: form.notes || null,
      })

      if (error) {
        throw error
      }

      setForm((prev) => ({ ...prev, notes: '' }))
      await fetchData()
    } catch (err) {
      console.error(err)
      setError('Error guardando disponibilidad.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Configurar disponibilidad</h2>
            <p className="mt-2 text-sm text-slate-600">Define horarios recurrentes por médico, sede y consultorio.</p>
          </div>
          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Médico</label>
              <select
                value={form.doctor_id}
                onChange={(event) => setForm((prev) => ({ ...prev, doctor_id: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              >
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.metadata?.name || 'Médico sin nombre'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Sede</label>
              <select
                value={form.location_id}
                onChange={(event) => setForm((prev) => ({ ...prev, location_id: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Consultorio</label>
              <select
                value={form.room_id}
                onChange={(event) => setForm((prev) => ({ ...prev, room_id: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              >
                {rooms.filter((room) => room.location_id === form.location_id).map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Día</label>
                <select
                  value={form.day_of_week}
                  onChange={(event) => setForm((prev) => ({ ...prev, day_of_week: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                >
                  {weekdays.map((label, index) => (
                    <option key={index} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Recurrente</label>
                <select
                  value={form.is_recurring ? 'yes' : 'no'}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_recurring: event.target.value === 'yes' }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                >
                  <option value="yes">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Inicio</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Fin</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="availability-active"
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <label htmlFor="availability-active" className="text-sm text-slate-700">Activo</label>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Notas</label>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <CalendarDays className="h-4 w-4" />
              Guardar disponibilidad
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Clock4 className="h-5 w-5 text-slate-600" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Disponibilidades configuradas</h2>
            <p className="mt-1 text-sm text-slate-600">Revisa los horarios activos por médico y consultorio.</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando disponibilidades…</p>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-slate-500">No hay disponibilidades definidas.</p>
          ) : (
            schedules.map((schedule) => {
              const doctor = doctors.find((item) => item.id === schedule.doctor_id)
              const room = rooms.find((item) => item.id === schedule.room_id)
              const location = locations.find((item) => item.id === schedule.location_id)
              return (
                <div key={schedule.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{doctor?.metadata?.name || 'Médico sin nombre'}</p>
                      <p className="text-sm text-slate-500">{schedule.is_recurring ? 'Recurrente' : 'No recurrente'}</p>
                    </div>
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${schedule.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {schedule.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-slate-600">{weekdays[schedule.day_of_week]} · {schedule.start_time} - {schedule.end_time}</p>
                    <p className="text-sm text-slate-600">{location?.name || 'Sede desconocida'} · {room?.name || 'Consultorio'}</p>
                  </div>
                  {schedule.notes && <p className="mt-3 text-sm text-slate-600">Notas: {schedule.notes}</p>}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
