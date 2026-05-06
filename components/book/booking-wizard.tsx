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
  XCircle,
} from 'lucide-react'
import { getBookedSlots } from '@/app/actions/booking'

interface DoctorMetadata {
  name?: string | null
  default_duration?: number | null
  duration?: number | null
  photo_url?: string | null
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
  field_label?: string
  field_type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea'
  placeholder?: string
  required: boolean
  sort_order: number
}

interface AppointmentTypeOption {
  id?: string
  name: string
  slug: string
  duration_minutes: number
  modality: 'presencial' | 'virtual' | 'patient_choice'
  color: string
  doctor_ids?: string[]
  languages?: string[]
  assignment_mode?: 'one_on_one' | 'round_robin_proportional' | 'round_robin_availability' | 'hybrid'
  min_notice_hours?: number
  price?: number | null
}

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español',   flag: '🇨🇴' },
  { value: 'en', label: 'English',   flag: '🇺🇸' },
  { value: 'pt', label: 'Português', flag: '🇧🇷' },
]

const TRANSLATIONS = {
  es: {
    // Step indicator
    stepPreferences:  'Preferencias',
    stepDate:         'Fecha',
    stepConfirmation: 'Confirmación',
    // Step 1
    step1Heading:     'Tu cita',
    step1Subtitle:    'Elige tus preferencias',
    langLabel:        'Idioma',
    modalityLabel:    'Modalidad',
    presencial:       '📍 Presencial',
    virtual:          '💻 Virtual',
    noPreference:     'Sin preferencia',
    autoAssignSub:    'Asignación automática al médico disponible',
    availableToday:   'Disponible hoy',
    docFallback:      'Médico',
    // Step 2
    step2Heading:     'Fecha y hora',
    // Step 3
    step3Heading:     'Tus datos',
    sumType:          'Tipo',
    sumDoctor:        'Médico',
    sumDate:          'Fecha',
    sumTime:          'Hora',
    sumModality:      'Modalidad',
    sumLanguage:      'Idioma',
    sumFee:           'Valor',
    sumFeeNote:       'Se paga en el consultorio',
    sumPresencial:    'Presencial',
    sumVirtual:       'Virtual',
    fieldName:        'Nombre *',
    fieldLastName:    'Apellido *',
    fieldPhone:       'Teléfono *',
    fieldEmail:       'Email *',
    fieldId:          'Cédula *',
    submitting:       'Agendando...',
    confirmBtn:       'Confirmar cita',
    autoAssign:       'Asignación automática',
    // Step 4 success
    successTitle:     '¡Cita agendada!',
    successSub:       'Recibirás una confirmación por email.',
    summaryTitle:     'Resumen',
    autoAssigned:     'Asignado automáticamente',
    sumPatient:       'Paciente',
    // Step 4 error
    errorTitle:       'No se pudo agendar',
    errorLabel:       'Error',
    errorDefault:     'Error desconocido. Intenta de nuevo.',
    retryBtn:         'Volver e intentar de nuevo',
    // Header & nav
    headerLabel:      'Reservar cita',
    publicBookings:   'Reservas públicas',
    badgePresencial:  '📍 Solo presencial',
    badgeVirtual:     '💻 Solo virtual',
    next:             'Siguiente',
    previous:         'Anterior',
    // CalendarPicker
    calOrg:           'Organización',
    calDoctor:        'Médico',
    calAutoAssign:    'Asignación automática',
    calSelected:      'Seleccionado',
    calLoading:       'Cargando horarios...',
    calNoSlots:       'No hay horarios disponibles.',
  },
  en: {
    stepPreferences:  'Preferences',
    stepDate:         'Date',
    stepConfirmation: 'Confirmation',
    step1Heading:     'Your appointment',
    step1Subtitle:    'Choose your preferences',
    langLabel:        'Language',
    modalityLabel:    'Modality',
    presencial:       '📍 In person',
    virtual:          '💻 Virtual',
    noPreference:     'No preference',
    autoAssignSub:    'Automatic assignment to available doctor',
    availableToday:   'Available today',
    docFallback:      'Doctor',
    step2Heading:     'Date & time',
    step3Heading:     'Your details',
    sumType:          'Type',
    sumDoctor:        'Doctor',
    sumDate:          'Date',
    sumTime:          'Time',
    sumModality:      'Modality',
    sumLanguage:      'Language',
    sumFee:           'Fee',
    sumFeeNote:       'Payable at the clinic',
    sumPresencial:    'In person',
    sumVirtual:       'Virtual',
    fieldName:        'First name *',
    fieldLastName:    'Last name *',
    fieldPhone:       'Phone *',
    fieldEmail:       'Email *',
    fieldId:          'ID number *',
    submitting:       'Booking...',
    confirmBtn:       'Confirm appointment',
    autoAssign:       'Automatic assignment',
    successTitle:     'Appointment booked!',
    successSub:       'You will receive a confirmation by email.',
    summaryTitle:     'Summary',
    autoAssigned:     'Automatically assigned',
    sumPatient:       'Patient',
    errorTitle:       'Could not book',
    errorLabel:       'Error',
    errorDefault:     'Unknown error. Please try again.',
    retryBtn:         'Go back and try again',
    headerLabel:      'Book appointment',
    publicBookings:   'Online booking',
    badgePresencial:  '📍 In person only',
    badgeVirtual:     '💻 Virtual only',
    next:             'Next',
    previous:         'Previous',
    calOrg:           'Organization',
    calDoctor:        'Doctor',
    calAutoAssign:    'Automatic assignment',
    calSelected:      'Selected',
    calLoading:       'Loading times...',
    calNoSlots:       'No available time slots.',
  },
} satisfies Record<string, Record<string, string>>

interface BookingWizardProps {
  orgName: string
  orgSlug: string
  orgId: string
  doctors: DoctorOption[]
  locations: LocationOption[]
  schedules: ScheduleOption[]
  formFields: FormField[]
  appointmentType?: AppointmentTypeOption
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

function buildCalendarGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rawDow = firstDay.getDay()
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
  durationOverride?: number
  minNoticeHours?: number
  texts: {
    org: string; doctor: string; autoAssign: string
    selected: string; loading: string; noSlots: string; docFallback: string
  }
}

function CalendarPicker({
  orgName,
  selectedDoctor,
  effectiveSchedules,
  selectedDate,
  selectedTime,
  onSelect,
  doctorId,
  durationOverride,
  minNoticeHours = 0,
  texts,
}: CalendarPickerProps) {
  const today = todayBogota()
  const minAllowedTime = new Date(Date.now() + minNoticeHours * 3600 * 1000)
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
    ? String(selectedDoctor.metadata?.name ?? texts.docFallback)
    : texts.autoAssign

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

  const calendarGrid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const availableSupabaseDays = useMemo(() => {
    const set = new Set<number>()
    effectiveSchedules.forEach((s) => set.add(Number(s.day_of_week)))
    return set
  }, [effectiveSchedules])

  function isDayAvailable(dateStr: string): boolean {
    const d = new Date(dateStr + 'T12:00:00')
    const supabaseDay = toSupabaseDay(d.getDay())
    if (!availableSupabaseDays.has(supabaseDay)) return false
    // Block days where even the end of the day (23:59) is before minAllowedTime
    const endOfDay = new Date(dateStr + 'T23:59:00')
    return endOfDay >= minAllowedTime
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
    return Array.from(all)
      .filter(slot => new Date(selectedDate + 'T' + slot + ':00') >= minAllowedTime)
      .sort()
  }, [selectedDate, effectiveSchedules, duration, minAllowedTime])

  function isSlotBooked(time: string): boolean {
    if (!selectedDate || !doctorId) return false
    const prefix = `${selectedDate}T${time}:`
    return bookedSlots.some((iso) => iso.startsWith(prefix))
  }

  const isPrevDisabled = viewYear === todayYear && viewMonth === todayMonth

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-0">
      <div className={[
        'flex flex-row flex-wrap items-center gap-x-3 gap-y-1 pb-3 border-b border-gray-100',
        'sm:flex-col sm:flex-nowrap sm:items-start sm:w-44 sm:flex-shrink-0 sm:pb-0 sm:border-b-0 sm:border-r sm:border-gray-100 sm:pr-5 sm:gap-4',
      ].join(' ')}>
        <div className="flex items-center gap-1.5 sm:block">
          <p className="text-xs font-semibold text-gray-900 sm:hidden">{orgName}</p>
          <span className="text-xs text-gray-300 sm:hidden">·</span>
          <p className="text-xs text-gray-700 font-medium sm:hidden">{doctorName}</p>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{texts.org}</p>
            <p className="font-semibold text-gray-900 text-sm">{orgName}</p>
          </div>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{texts.doctor}</p>
          <p className="font-medium text-gray-800 text-sm leading-snug">{doctorName}</p>
          {selectedDoctor?.specialty && (
            <p className="text-xs text-gray-500 mt-0.5">{selectedDoctor.specialty}</p>
          )}
          {!selectedDoctor && (
            <p className="text-xs text-gray-400 mt-0.5">{texts.autoAssign}</p>
          )}
        </div>
        <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 text-xs font-semibold">
          <Clock className="w-3 h-3" />
          {duration} min
        </div>
        {selectedDate && selectedTime && (
          <div className="hidden sm:block bg-gray-50 rounded-xl p-3 mt-auto w-full">
            <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{texts.selected}</p>
            <p className="text-xs text-gray-600 capitalize">
              {new Intl.DateTimeFormat('es-CO', {
                weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Bogota',
              }).format(new Date(selectedDate + 'T12:00:00'))}
            </p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedTime}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-1 sm:pl-5 sm:flex-row sm:gap-5 min-w-0">
        <div className="w-full sm:flex-shrink-0 sm:w-[252px]">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} disabled={isPrevDisabled}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-900 text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((label) => (
              <div key={label} className="text-center text-xs font-medium text-gray-400 py-1">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calendarGrid.map((dateStr, idx) => {
              if (!dateStr) return <div key={idx} />
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              const isPast = dateStr < today
              const isAvailable = isDayAvailable(dateStr)
              return (
                <button
                  key={dateStr}
                  disabled={isPast || !isAvailable}
                  onClick={() => onSelect(dateStr, '')}
                  className={[
                    'aspect-square rounded-lg text-xs font-medium transition flex items-center justify-center',
                    isSelected ? 'bg-blue-600 text-white' :
                    isToday && isAvailable ? 'ring-2 ring-blue-400 text-blue-700' :
                    isPast || !isAvailable ? 'text-gray-200 cursor-not-allowed' :
                    'hover:bg-blue-50 text-gray-700',
                  ].join(' ')}
                >
                  {Number(dateStr.slice(8))}
                </button>
              )
            })}
          </div>
        </div>

        {selectedDate && (
          <div className="sm:flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 capitalize">
              {new Intl.DateTimeFormat('es-CO', {
                weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
              }).format(new Date(selectedDate + 'T12:00:00'))}
            </p>
            {slotsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                {texts.loading}
              </div>
            ) : slotsForDate.length === 0 ? (
              <p className="text-sm text-gray-400">{texts.noSlots}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-2">
                {slotsForDate.map((time) => {
                  const booked = isSlotBooked(time)
                  const selected = time === selectedTime
                  return (
                    <button
                      key={time}
                      disabled={booked}
                      onClick={() => onSelect(selectedDate, time)}
                      className={[
                        'rounded-xl px-3 py-2 text-sm font-medium transition text-center',
                        selected ? 'bg-blue-600 text-white' :
                        booked ? 'bg-gray-50 text-gray-300 cursor-not-allowed line-through' :
                        'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                      ].join(' ')}
                    >
                      {time}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Doctor avatar helper ──────────────────────────────────────────────────────

function DoctorAvatar({
  name, photoUrl, color, size = 'md',
}: { name: string; photoUrl?: string | null; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const sz = size === 'sm' ? 'h-6 w-6 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm'
  if (photoUrl) return <img src={photoUrl} alt={name} className={`${sz} rounded-full object-cover shrink-0`} />
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}>
      {initials || '?'}
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
  appointmentType,
}: BookingWizardProps) {
  const typeColor   = appointmentType?.color ?? '#6366f1'
  const fixedModality: 'presencial' | 'virtual' | null =
    appointmentType?.modality === 'presencial' ? 'presencial' :
    appointmentType?.modality === 'virtual'    ? 'virtual'    : null

  const showLangToggle    = (appointmentType?.languages?.length ?? 0) >= 2
  const showModalityToggle = appointmentType?.modality === 'patient_choice'
  const showDoctorSelection =
    appointmentType?.assignment_mode === 'hybrid' ||
    appointmentType?.assignment_mode === 'one_on_one' ||
    !appointmentType?.assignment_mode // fallback when not set

  // Skip step 1 when there's nothing for the user to choose
  const skipStep1 = !showLangToggle && !showModalityToggle && !showDoctorSelection

  // assignedIds from the doctor filter (already computed in booking-wizard)
  const assignedIds = appointmentType?.doctor_ids?.length ? appointmentType.doctor_ids : null
  const availableDoctors = doctors.filter(
    (d) => d.is_active && (assignedIds === null || assignedIds.includes(d.id))
  )

  // step 4 = success/error screen (not shown in indicator)
  const stepOrder: number[] = skipStep1 ? [2, 3, 4] : [1, 2, 3, 4]
  const [currentStep, setCurrentStep] = useState(stepOrder[0])

  const [formData, setFormData] = useState({
    modality: (fixedModality ?? 'presencial') as 'presencial' | 'virtual',
    language: appointmentType?.languages?.[0] ?? 'es',
    doctor_id: '',
    date: '',
    time: '',
    patient_first_name: '',
    patient_last_name:  '',
    phone: '',
    email: '',
    cedula: '',
    customFields: {} as Record<string, string>,
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Reactive translations — updates when user picks a different language in step 1
  const t = TRANSLATIONS[formData.language as 'es' | 'en'] ?? TRANSLATIONS.es

  const selectedDoctor = useMemo(
    () => availableDoctors.find((d) => d.id === formData.doctor_id) ?? null,
    [availableDoctors, formData.doctor_id]
  )

  const effectiveSchedules = useMemo(
    () => formData.doctor_id
      ? schedules.filter((s) => s.doctor_id === formData.doctor_id)
      : schedules,
    [schedules, formData.doctor_id]
  )

  // Does a doctor have any schedule for today?
  function hasSlotToday(doctorId: string): boolean {
    const d = new Date(todayBogota() + 'T12:00:00')
    const supabaseDay = toSupabaseDay(d.getDay())
    return schedules.some(s => s.doctor_id === doctorId && Number(s.day_of_week) === supabaseDay)
  }

  const goNext = () => {
    const i = stepOrder.indexOf(currentStep)
    if (i < stepOrder.length - 1) setCurrentStep(stepOrder[i + 1])
  }
  const goPrev = () => {
    const i = stepOrder.indexOf(currentStep)
    if (i > 0) setCurrentStep(stepOrder[i - 1])
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_slug:            orgSlug,
          appointment_type_id: appointmentType?.id ?? null,
          modality:     formData.modality,
          language:     formData.language,
          doctor_id:    formData.doctor_id || null,
          date:         formData.date,
          time:         formData.time,
          patient_first_name: formData.patient_first_name,
          patient_last_name:  formData.patient_last_name,
          phone:        formData.phone,
          email:        formData.email,
          cedula:       formData.cedula,
          custom_fields: formData.customFields,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Error creando la cita')
      setSuccess(true)
      setCurrentStep(4)
    } catch (err) {
      setError((err as Error).message)
      setCurrentStep(4)
    } finally {
      setLoading(false)
    }
  }

  // ── Step indicator (always 3 visible steps) ───────────────────────────────

  const INDICATOR_LABELS = [t.stepPreferences, t.stepDate, t.stepConfirmation]

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {INDICATOR_LABELS.map((label, idx) => {
        const pos    = idx + 1        // visual position 1-3
        const active = pos <= Math.min(currentStep, 3)
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {pos}
              </div>
              <span className={`text-[11px] font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {idx < 2 && (
              <div className={`w-10 h-0.5 mx-2 mb-4 transition-colors ${pos < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )

  // ── Step 1 — Tu cita (language + modality toggles + doctor selection) ──────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{t.step1Heading}</h2>
        <p className="text-gray-500 mt-1 text-sm">{t.step1Subtitle}</p>
      </div>

      {/* Inline pill toggles */}
      {(showLangToggle || showModalityToggle) && (
        <div className="flex flex-wrap gap-4">
          {showLangToggle && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">{t.langLabel}</span>
              <div className="flex rounded-full border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
                {LANGUAGE_OPTIONS
                  .filter(l => appointmentType?.languages?.includes(l.value))
                  .map(l => (
                    <button key={l.value}
                      onClick={() => setFormData(p => ({ ...p, language: l.value }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        formData.language === l.value
                          ? 'bg-white shadow text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {l.flag} {l.label}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {showModalityToggle && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">{t.modalityLabel}</span>
              <div className="flex rounded-full border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
                {[{ value: 'presencial', label: t.presencial }, { value: 'virtual', label: t.virtual }].map(m => (
                  <button key={m.value}
                    onClick={() => setFormData(p => ({ ...p, modality: m.value as 'presencial' | 'virtual' }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      formData.modality === m.value
                        ? 'bg-white shadow text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Doctor selection */}
      {showDoctorSelection && (
        <div className="space-y-3">
          {/* Sin preferencia */}
          <button
            onClick={() => setFormData(p => ({ ...p, doctor_id: '', date: '', time: '' }))}
            className={`w-full flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
              formData.doctor_id === '' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{t.noPreference}</p>
              <p className="text-sm text-gray-500">{t.autoAssignSub}</p>
            </div>
          </button>

          {/* Doctor cards — 2-column grid */}
          <div className="grid grid-cols-2 gap-3">
            {availableDoctors.map(doc => {
              const name     = String(doc.metadata?.name ?? t.docFallback)
              const photoUrl = doc.metadata?.photo_url as string | null | undefined
              const isSelected = formData.doctor_id === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => setFormData(p => ({ ...p, doctor_id: doc.id, date: '', time: '' }))}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition ${
                    isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <DoctorAvatar name={name} photoUrl={photoUrl} color={typeColor} size="lg" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{name}</p>
                    {doc.specialty && <p className="text-xs text-gray-500 mt-0.5">{doc.specialty}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  // ── Step 2 — Fecha y hora ─────────────────────────────────────────────────

  const renderStep2 = () => {
    const docName  = selectedDoctor ? String(selectedDoctor.metadata?.name ?? t.docFallback) : null
    const photoUrl = selectedDoctor?.metadata?.photo_url as string | null | undefined
    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t.step2Heading}</h2>
          {docName && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5">
              <DoctorAvatar name={docName} photoUrl={photoUrl} color={typeColor} size="sm" />
              <span className="text-sm font-medium text-gray-700">{docName}</span>
            </div>
          )}
        </div>
        <CalendarPicker
          orgName={orgName}
          selectedDoctor={selectedDoctor}
          effectiveSchedules={effectiveSchedules}
          selectedDate={formData.date}
          selectedTime={formData.time}
          onSelect={(date, time) => setFormData(p => ({ ...p, date, time }))}
          doctorId={formData.doctor_id}
          minNoticeHours={appointmentType?.min_notice_hours ?? 0}
          texts={{ org: t.calOrg, doctor: t.calDoctor, autoAssign: t.calAutoAssign, selected: t.calSelected, loading: t.calLoading, noSlots: t.calNoSlots, docFallback: t.docFallback }}
        />
      </div>
    )
  }

  // ── Step 3 — Tus datos + summary + confirm ────────────────────────────────

  const renderStep3 = () => {
    const docName  = selectedDoctor ? String(selectedDoctor.metadata?.name ?? t.docFallback) : t.autoAssign
    const photoUrl = selectedDoctor?.metadata?.photo_url as string | null | undefined
    const langLabel = LANGUAGE_OPTIONS.find(l => l.value === formData.language)?.label ?? 'Español'
    const canSubmit = !loading && !!formData.patient_first_name && !!formData.patient_last_name && !!formData.phone && !!formData.email && !!formData.cedula

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{t.step3Heading}</h2>
        </div>

        {/* Summary */}
        <div className="rounded-2xl bg-gray-50 px-5 py-4 space-y-2.5 text-sm">
          {appointmentType && (
            <div className="flex justify-between">
              <span className="text-gray-500">{t.sumType}</span>
              <span className="font-medium text-gray-900">{appointmentType.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{t.sumDoctor}</span>
            <div className="flex items-center gap-1.5">
              {selectedDoctor && <DoctorAvatar name={docName} photoUrl={photoUrl} color={typeColor} size="sm" />}
              <span className="font-medium text-gray-900">{docName}</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t.sumDate}</span>
            <span className="font-medium text-gray-900">
              {formData.date
                ? new Intl.DateTimeFormat('es-CO', {
                    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota',
                  }).format(new Date(formData.date + 'T12:00:00'))
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t.sumTime}</span>
            <span className="font-medium text-gray-900">{formData.time || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t.sumModality}</span>
            <span className="font-medium text-gray-900">{formData.modality === 'presencial' ? t.sumPresencial : t.sumVirtual}</span>
          </div>
          {showLangToggle && (
            <div className="flex justify-between">
              <span className="text-gray-500">{t.sumLanguage}</span>
              <span className="font-medium text-gray-900">{langLabel}</span>
            </div>
          )}
          {appointmentType?.price && appointmentType.price > 0 && (
            <div className="flex justify-between items-start">
              <span className="text-gray-500">{t.sumFee}</span>
              <div className="text-right">
                <span className="font-medium text-gray-900">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(appointmentType.price)}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">{t.sumFeeNote}</p>
              </div>
            </div>
          )}
        </div>

        {/* Patient form */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.fieldName}</label>
            <input type="text" value={formData.patient_first_name}
              onChange={e => setFormData(p => ({ ...p, patient_first_name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.fieldLastName}</label>
            <input type="text" value={formData.patient_last_name}
              onChange={e => setFormData(p => ({ ...p, patient_last_name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.fieldPhone}</label>
            <input type="tel" value={formData.phone}
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.fieldEmail}</label>
            <input type="email" value={formData.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" required />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.fieldId}</label>
            <input type="text" value={formData.cedula}
              onChange={e => setFormData(p => ({ ...p, cedula: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" required />
          </div>
          {formFields.map(field => (
            <div key={field.field_name} className={field.field_type === 'textarea' || field.field_type === 'text' ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {field.field_label ?? field.field_name} {field.required ? '*' : ''}
              </label>
              {field.field_type === 'textarea' ? (
                <textarea
                  value={formData.customFields[field.field_name] || ''}
                  onChange={e => setFormData(p => ({
                    ...p, customFields: { ...p.customFields, [field.field_name]: e.target.value },
                  }))}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                  required={field.required}
                />
              ) : (
                <input
                  type={field.field_type}
                  value={formData.customFields[field.field_name] || ''}
                  onChange={e => setFormData(p => ({
                    ...p, customFields: { ...p.customFields, [field.field_name]: e.target.value },
                  }))}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required={field.required}
                />
              )}
            </div>
          ))}
        </div>

        {/* Confirm button lives inside step 3 */}
        <button onClick={handleSubmit} disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t.submitting}</>
            : <><UserPlus className="w-4 h-4" /> {t.confirmBtn}</>}
        </button>
      </div>
    )
  }

  // ── Step 4 — Success / Error ──────────────────────────────────────────────

  const renderStep4 = () => {
    if (success) {
      return (
        <div className="text-center space-y-6">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">{t.successTitle}</h2>
          <p className="text-gray-600">{t.successSub}</p>
          <div className="bg-gray-50 p-6 rounded-2xl text-left space-y-3 text-sm">
            <p className="font-semibold text-gray-900 text-base mb-1">{t.summaryTitle}</p>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">{t.sumDoctor}</span>
              <span className="font-medium text-gray-900">
                {selectedDoctor
                  ? String(selectedDoctor.metadata?.name ?? t.autoAssigned)
                  : t.autoAssigned}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">{t.sumDate}</span>
              <span className="font-medium text-gray-900">
                {new Intl.DateTimeFormat('es-CO', {
                  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
                }).format(new Date(formData.date + 'T12:00:00'))}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">{t.sumTime}</span>
              <span className="font-medium text-gray-900">{formData.time}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">{t.sumModality}</span>
              <span className="font-medium text-gray-900">
                {formData.modality === 'presencial' ? t.sumPresencial : t.sumVirtual}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.sumPatient}</span>
              <span className="font-medium text-gray-900">{[formData.patient_first_name, formData.patient_last_name].filter(Boolean).join(' ')}</span>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <XCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{t.errorTitle}</h2>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-left">
          <p className="font-semibold mb-1">{t.errorLabel}</p>
          <p>{error || t.errorDefault}</p>
        </div>
        <button onClick={() => { setError(null); goPrev() }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">
          <ArrowLeft className="w-4 h-4" />
          {t.retryBtn}
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const step2Ready = currentStep !== 2 || (!!formData.date && !!formData.time)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-500">{t.headerLabel}</p>
            <h1 className="text-3xl font-bold text-gray-900">{orgName}</h1>
            {appointmentType && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="text-base font-medium text-gray-700">{appointmentType.name}</p>
                {fixedModality === 'presencial' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {t.badgePresencial}
                  </span>
                )}
                {fixedModality === 'virtual' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                    {t.badgeVirtual}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            <CalendarDays className="h-4 w-4 text-violet-600" />
            {t.publicBookings}
          </div>
        </div>

        {currentStep < 4 && renderStepIndicator()}

        <div className="min-h-[420px]">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Navigation — Next/Back only for steps 1 and 2; step 3 has its own confirm button */}
        {currentStep < 3 && (
          <div className="flex justify-between mt-8">
            {currentStep > stepOrder[0] ? (
              <button onClick={goPrev}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                <ArrowLeft className="w-4 h-4" /> {t.previous}
              </button>
            ) : <div />}
            <button onClick={goNext} disabled={!step2Ready}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 ml-auto transition disabled:opacity-40 disabled:cursor-not-allowed">
              {t.next} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {currentStep === 3 && (
          <div className="mt-8">
            <button onClick={goPrev}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              <ArrowLeft className="w-4 h-4" /> {t.previous}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
