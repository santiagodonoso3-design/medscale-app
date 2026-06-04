'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, UserPlus } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'

interface DoctorMetadata {
  name?: string | null
  default_duration?: number | null
  [key: string]: unknown
}

interface DoctorOption {
  id: string
  specialty: string | null
  is_active: boolean
  metadata: DoctorMetadata | null
}

interface LocationOption {
  id: string
  name: string
}

interface ScheduleOption {
  id: string
  doctor_id: string
  location_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

interface BookingClientProps {
  orgName: string
  orgSlug: string
  doctors: DoctorOption[]
  locations: LocationOption[]
  schedules: ScheduleOption[]
}

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function BookingClient({ orgName, orgSlug, doctors, locations, schedules }: BookingClientProps) {
  const [form, setForm] = useState({
    doctor_id: doctors[0]?.id || '',
    location_id: locations[0]?.id || '',
    date: '',
    time: '09:00',
    patient_name: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const availableDoctors = doctors.filter((doctor) => doctor.is_active)
  const availableLocations = locations

  const selectedDoctor = useMemo(
    () => availableDoctors.find((doctor) => doctor.id === form.doctor_id) ?? availableDoctors[0],
    [availableDoctors, form.doctor_id]
  )

  const availableSchedules = useMemo(() => {
    if (!selectedDoctor) return []
    return schedules.filter((schedule) => schedule.doctor_id === selectedDoctor.id && schedule.location_id === form.location_id)
  }, [schedules, selectedDoctor, form.location_id])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const scheduledAt = `${form.date}T${form.time}:00.000Z`
      const payload = {
        org_slug: orgSlug,
        doctor_id: form.doctor_id,
        location_id: form.location_id,
        patient_name: form.patient_name,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
        scheduled_at: scheduledAt,
        duration_minutes: Number(selectedDoctor?.metadata?.default_duration || 30),
      }

      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo reservar la cita')
      }

      setMessage('Cita creada correctamente. Pronto recibirás confirmación.')
    } catch (error) {
      setMessage((error as Error).message || 'Error creando la cita.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Reservar cita</p>
            <h1 className="text-3xl font-bold text-slate-900">{orgName}</h1>
            <p className="mt-2 text-slate-600">Selecciona médico, fecha y completa tus datos para solicitar una cita.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <CalendarDays className="h-4 w-4 text-violet-600" />
            Reservas públicas
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">Médico</label>
            <select
              value={form.doctor_id}
              onChange={(event) => setForm((prev) => ({ ...prev, doctor_id: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            >
              {availableDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {String(doctor.metadata?.name ?? 'Médico')} — {doctor.specialty || 'General'}
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
              {availableLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Fecha</label>
            <div className="mt-2">
              <DatePicker
                value={form.date}
                onChange={(d) => setForm((prev) => ({ ...prev, date: d }))}
                placeholder="Seleccionar fecha"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Hora</label>
            <input
              type="time"
              value={form.time}
              onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-medium text-slate-700">Nombre</label>
            <input
              value={form.patient_name}
              onChange={(event) => setForm((prev) => ({ ...prev, patient_name: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              placeholder="Nombre completo"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Teléfono</label>
            <input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              placeholder="Ej: +5491123456789"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              placeholder="paciente@correo.com"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-medium text-slate-700">Notas</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="font-medium text-slate-900">Duración sugerida</div>
            <div>{String(selectedDoctor?.metadata?.default_duration ?? 30)} minutos</div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Reservar cita
          </button>
        </div>

        {message && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800">
            {message}
          </div>
        )}
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-slate-900">
          <Clock3 className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold">Horarios disponibles</h2>
            <p className="mt-1 text-sm text-slate-600">Tus elecciones se basan en horarios configurados para el médico y la sede.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {availableSchedules.map((schedule) => {
            const doctor = doctors.find((item) => item.id === schedule.doctor_id)
            const location = locations.find((item) => item.id === schedule.location_id)
            return (
              <div key={schedule.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{String(doctor?.metadata?.name ?? 'Médico')}</p>
                <p className="text-sm text-slate-600">{location?.name || 'Sede desconocida'}</p>
                <p className="mt-3 text-sm text-slate-700">{weekdays[schedule.day_of_week]} · {schedule.start_time} - {schedule.end_time}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
