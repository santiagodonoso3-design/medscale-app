'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  UserPlus,
} from 'lucide-react'
import { getBookedSlots } from '@/app/actions/booking'

interface DoctorMetadata {
  name?: string | null
  default_duration?: number | null
  duration?: number | null
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

interface FormField {
  field_name: string
  field_type: 'text' | 'email' | 'tel' | 'number'
  required: boolean
  order: number
}

interface BookingWizardProps {
  orgName: string
  orgSlug: string
  orgId: string
  doctors: DoctorOption[]
  locations: LocationOption[]
  schedules: ScheduleOption[]
  formFields: FormField[]
}

// ── Calendar utilities ────────────────────────────────────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

// JS getDay(): 0=Sun..6=Sat → Supabase day_of_week: 1=Mon..7=Sun
function toSupabaseDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay
}

function generateSlots(startTime: string, endTime: string, durationMin: number): string[] {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  const slots: string[] = []
  for (let t = start; t + durationMin <= end; t += durationMin) {
    slots.push(
      `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    )
  }
  return slots
}

// Monday-first grid: returns YYYY-MM-DD strings (null for empty leading/trailing cells)
function buildCalendarGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rawDow = firstDay.getDay() // 0=Sun
  const leadingEmpties = rawDow === 0 ? 6 : rawDow - 1

  const grid: (string | null)[] = Array(leadingEmpties).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    )
  }
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

// ── CalendarPicker ────────────────────────────────────────────────────────────

interface CalendarPickerProps {
  orgName: string
  selectedDoctor: DoctorOption | null
  effectiveSchedules: ScheduleOption[]
  selectedDate: string
  selectedTime: string
  onSelect: (date: string, time: string) => void
  doctorId: string
}

function CalendarPicker({
  orgName,
  selectedDoctor,
  effectiveSchedules,
  selectedDate,
  selectedTime,
  onSelect,
  doctorId,
}: CalendarPickerProps) {
  const today = todayBogota()
  const todayYear = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7)) - 1

  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth)
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  const duration = Number(
    selectedDoctor?.metadata?.duration ||
    selectedDoctor?.metadata?.default_duration ||
    60
  )

  const doctorName = selectedDoctor
    ? String(selectedDoctor.metadata?.name ?? 'Médico')
    : 'Sin preferencia'

  useEffect(() => {
    if (!doctorId) {
      setBookedSlots([])
      return
    }
    setSlotsLoading(true)
    getBookedSlots(doctorId, viewYear, viewMonth)
      .then(setBookedSlots)
      .catch(() => setBookedSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [doctorId, viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  const calendarGrid = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  const availableSupabaseDays = useMemo(() => {
    const set = new Set<number>()
    // Number() guards against day_of_week arriving as string from Supabase
    effectiveSchedules.forEach((s) => set.add(Number(s.day_of_week)))
    console.log('[CalendarPicker] schedules:', effectiveSchedules.length, '| days:', Array.from(set))
    return set
  }, [effectiveSchedules])

  function isDayAvailable(dateStr: string): boolean {
    const d = new Date(dateStr + 'T12:00:00')
    const supabaseDay = toSupabaseDay(d.getDay())
    return availableSupabaseDays.has(supabaseDay)
  }

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return []
    const d = new Date(selectedDate + 'T12:00:00')
    const supabaseDay = toSupabaseDay(d.getDay())
    const matching = effectiveSchedules.filter((s) => s.day_of_week === supabaseDay)
    const all = new Set<string>()
    matching.forEach((s) =>
      generateSlots(s.start_time, s.end_time, duration).forEach((slot) => all.add(slot))
    )
    return Array.from(all).sort()
  }, [selectedDate, effectiveSchedules, duration])

  function isSlotBooked(time: string): boolean {
    if (!selectedDate || !doctorId) return false
    const prefix = `${selectedDate}T${time}:`
    return bookedSlots.some((iso) => iso.startsWith(prefix))
  }

  const isPrevDisabled = viewYear === todayYear && viewMonth === todayMonth

  return (
    <div className="flex gap-0 h-full">
      {/* Left info panel */}
      <div className="w-52 flex-shrink-0 border-r border-gray-100 pr-6 flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Organización
          </p>
          <p className="font-semibold text-gray-900 text-sm">{orgName}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Médico
          </p>
          <p className="font-medium text-gray-800 text-sm leading-snug">{doctorName}</p>
          {selectedDoctor?.specialty && (
            <p className="text-xs text-gray-500 mt-0.5">{selectedDoctor.specialty}</p>
          )}
          {!selectedDoctor && (
            <p className="text-xs text-gray-400 mt-0.5">Asignación automática</p>
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-full px-3 py-1.5 text-xs font-semibold w-fit">
          <Clock className="w-3 h-3" />
          {duration} min
        </div>

        {/* DEBUG: remove once schedules confirmed working */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
          <div>Schedules: {effectiveSchedules.length}</div>
          <div>Días: {Array.from(availableSupabaseDays).sort().join(', ') || 'ninguno'}</div>
        </div>

        {selectedDate && selectedTime && (
          <div className="bg-gray-50 rounded-xl p-3 mt-auto">
            <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Seleccionado
            </p>
            <p className="text-xs text-gray-600">
              {new Intl.DateTimeFormat('es-CO', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                timeZone: 'America/Bogota',
              }).format(new Date(selectedDate + 'T12:00:00'))}
            </p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedTime}</p>
          </div>
        )}
      </div>

      {/* Right: calendar + slots */}
      <div className="flex-1 pl-6 flex gap-6 min-w-0">
        {/* Monthly calendar */}
        <div className="flex-shrink-0">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              disabled={isPrevDisabled}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-900 w-36 text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="w-9 text-center text-xs font-medium text-gray-400 py-1"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {calendarGrid.map((dateStr, i) => {
              if (!dateStr) return <div key={i} className="w-9 h-9" />

              const isToday = dateStr === today
              const isPast = dateStr < today
              const hasSlots = isDayAvailable(dateStr)
              const isSelected = dateStr === selectedDate
              const isDisabled = isPast || !hasSlots

              return (
                <button
                  key={dateStr}
                  onClick={() => !isDisabled && onSelect(dateStr, '')}
                  disabled={isDisabled}
                  className={[
                    'w-9 h-9 rounded-full text-sm font-medium transition flex items-center justify-center',
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isToday && !isDisabled
                      ? 'border-2 border-blue-500 text-blue-700 hover:bg-blue-50'
                      : isDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                  ].join(' ')}
                >
                  {Number(dateStr.slice(8))}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time slots */}
        <div className="flex-1 min-w-0">
          {!selectedDate ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-gray-400 text-center px-4">
                Selecciona una fecha para ver horarios disponibles
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-3 capitalize">
                {new Intl.DateTimeFormat('es-CO', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  timeZone: 'America/Bogota',
                }).format(new Date(selectedDate + 'T12:00:00'))}
              </p>

              {slotsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                  Cargando horarios...
                </div>
              ) : slotsForDate.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">
                  No hay horarios disponibles para este día.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {slotsForDate.map((time) => {
                    const booked = isSlotBooked(time)
                    const isSelected = time === selectedTime
                    return (
                      <button
                        key={time}
                        onClick={() => !booked && onSelect(selectedDate, time)}
                        disabled={booked}
                        className={[
                          'py-2.5 px-3 rounded-xl text-sm font-medium text-center transition border',
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : booked
                            ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50',
                        ].join(' ')}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── BookingWizard ─────────────────────────────────────────────────────────────

export default function BookingWizard({
  orgName,
  orgSlug,
  orgId,
  doctors,
  locations,
  schedules,
  formFields,
}: BookingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    modality: 'presencial' as 'presencial' | 'virtual',
    doctor_id: '',
    date: '',
    time: '',
    patient_name: '',
    phone: '',
    email: '',
    cedula: '',
    customFields: {} as Record<string, string>,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const availableDoctors = doctors.filter((d) => d.is_active)

  const selectedDoctor = useMemo(
    () => availableDoctors.find((d) => d.id === formData.doctor_id) ?? null,
    [availableDoctors, formData.doctor_id]
  )

  // Schedules for the calendar: specific doctor or all active doctors
  const effectiveSchedules = useMemo(
    () =>
      formData.doctor_id
        ? schedules.filter((s) => s.doctor_id === formData.doctor_id)
        : schedules,
    [schedules, formData.doctor_id]
  )

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1)
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = {
        org_slug: orgSlug,
        modality: formData.modality,
        doctor_id: formData.doctor_id || null,
        date: formData.date,
        time: formData.time,
        patient_name: formData.patient_name,
        phone: formData.phone,
        email: formData.email,
        cedula: formData.cedula,
        custom_fields: formData.customFields,
      }

      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error creando la cita')
      }

      setSuccess(true)
      setCurrentStep(5)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {step}
          </div>
          {step < 4 && (
            <div
              className={`w-12 h-0.5 ${step < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Tipo de consulta</h2>
        <p className="text-gray-600 mt-2">Selecciona cómo prefieres realizar tu consulta</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setFormData({ ...formData, modality: 'presencial' })}
          className={`p-6 rounded-2xl border-2 transition ${
            formData.modality === 'presencial'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Presencial</h3>
            <p className="text-sm text-gray-600 mt-1">En la clínica</p>
          </div>
        </button>
        <button
          onClick={() => setFormData({ ...formData, modality: 'virtual' })}
          className={`p-6 rounded-2xl border-2 transition ${
            formData.modality === 'virtual'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock3 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Virtual</h3>
            <p className="text-sm text-gray-600 mt-1">Por videollamada</p>
          </div>
        </button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Selecciona médico</h2>
        <p className="text-gray-600 mt-2">Elige un médico específico o sin preferencia</p>
      </div>
      <div className="space-y-3">
        <button
          onClick={() => setFormData({ ...formData, doctor_id: '', date: '', time: '' })}
          className={`w-full p-4 rounded-2xl border-2 text-left transition ${
            formData.doctor_id === ''
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="font-semibold text-gray-900">Sin preferencia</div>
          <div className="text-sm text-gray-600">Asignación automática al médico disponible</div>
        </button>
        {availableDoctors.map((doctor) => (
          <button
            key={doctor.id}
            onClick={() =>
              setFormData({ ...formData, doctor_id: doctor.id, date: '', time: '' })
            }
            className={`w-full p-4 rounded-2xl border-2 text-left transition ${
              formData.doctor_id === doctor.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">
              {String(doctor.metadata?.name ?? 'Médico')}
            </div>
            <div className="text-sm text-gray-600">{doctor.specialty || 'General'}</div>
          </button>
        ))}
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Fecha y hora</h2>
        <p className="text-gray-600 mt-2">Selecciona el día y horario de tu cita</p>
      </div>
      <CalendarPicker
        orgName={orgName}
        selectedDoctor={selectedDoctor}
        effectiveSchedules={effectiveSchedules}
        selectedDate={formData.date}
        selectedTime={formData.time}
        onSelect={(date, time) => setFormData({ ...formData, date, time })}
        doctorId={formData.doctor_id}
      />
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Tus datos</h2>
        <p className="text-gray-600 mt-2">Completa tu información para confirmar la cita</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre completo *
          </label>
          <input
            type="text"
            value={formData.patient_name}
            onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono *</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Cédula *</label>
          <input
            type="text"
            value={formData.cedula}
            onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        {formFields.map((field) => (
          <div key={field.field_name} className={field.field_type === 'text' ? 'col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.field_name} {field.required ? '*' : ''}
            </label>
            <input
              type={field.field_type}
              value={formData.customFields[field.field_name] || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  customFields: { ...formData.customFields, [field.field_name]: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required={field.required}
            />
          </div>
        ))}
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="text-center space-y-6">
      {success ? (
        <>
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">¡Cita agendada!</h2>
          <p className="text-gray-600">Recibirás una confirmación por email y SMS.</p>
          <div className="bg-gray-50 p-6 rounded-lg text-left">
            <h3 className="font-semibold text-gray-900 mb-4">Resumen de tu cita</h3>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Médico:</strong>{' '}
                {selectedDoctor
                  ? String(selectedDoctor.metadata?.name ?? 'Asignado automáticamente')
                  : 'Sin preferencia'}
              </div>
              <div><strong>Fecha:</strong> {formData.date}</div>
              <div><strong>Hora:</strong> {formData.time}</div>
              <div>
                <strong>Modalidad:</strong>{' '}
                {formData.modality === 'presencial' ? 'Presencial' : 'Virtual'}
              </div>
              <div><strong>Paciente:</strong> {formData.patient_name}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-900">Confirmar cita</h2>
          <div className="bg-gray-50 p-6 rounded-lg text-left">
            <h3 className="font-semibold text-gray-900 mb-4">Resumen</h3>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Médico:</strong>{' '}
                {selectedDoctor
                  ? String(selectedDoctor.metadata?.name ?? 'Médico')
                  : 'Sin preferencia'}
              </div>
              <div><strong>Fecha:</strong> {formData.date}</div>
              <div><strong>Hora:</strong> {formData.time}</div>
              <div>
                <strong>Modalidad:</strong>{' '}
                {formData.modality === 'presencial' ? 'Presencial' : 'Virtual'}
              </div>
              <div><strong>Paciente:</strong> {formData.patient_name}</div>
            </div>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </>
      )}
    </div>
  )

  const step3Ready = currentStep !== 3 || (!!formData.date && !!formData.time)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-500">
              Reservar cita
            </p>
            <h1 className="text-3xl font-bold text-gray-900">{orgName}</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            <CalendarDays className="h-4 w-4 text-violet-600" />
            Reservas públicas
          </div>
        </div>

        {renderStepIndicator()}

        <div className="min-h-[420px]">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </div>

        <div className="flex justify-between mt-8">
          {currentStep > 1 && currentStep < 5 && (
            <button
              onClick={handlePrev}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </button>
          )}
          {currentStep < 4 && (
            <button
              onClick={handleNext}
              disabled={!step3Ready}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {currentStep === 4 && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-auto disabled:opacity-50"
            >
              {loading ? 'Agendando...' : 'Confirmar cita'}
              <UserPlus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
