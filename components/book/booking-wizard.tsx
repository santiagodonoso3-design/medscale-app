'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Building,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  UserPlus,
  Video,
  XCircle,
} from 'lucide-react'
import { getBookedSlots } from '@/app/actions/booking'
import { DatePicker } from '@/components/ui/date-picker'
import { resolveBlocksForDate, resolveBlocksForAnyDoctor } from '@/lib/availability/resolve'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const B = {
  primary:   '#215F73',
  accent:    '#5A9DB5',
  fg:        '#0D2B3E',
  muted:     '#4A6B7A',
  bg:        '#EBF0F6',
  secondary: '#F3F7FA',
  border:    '#C8D8E4',
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
  address?: string | null
}

interface ScheduleOption {
  id: string
  doctor_id: string
  location_id: string | null
  day_of_week: number | null
  start_time: string | null
  end_time: string | null
  is_recurring: boolean
  active: boolean
  specific_date: string | null
}

interface FormField {
  field_name: string
  field_label?: string
  field_type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea' | 'select'
  placeholder?: string
  required: boolean
  sort_order: number
  options?: string[] | null
}

interface AppointmentTypeOption {
  id?: string
  name: string
  slug: string
  duration_minutes: number
  modality: 'presencial' | 'virtual' | 'patient_choice'
  color: string
  doctor_ids?: string[]
  assignment_mode?: 'one_on_one' | 'round_robin_proportional' | 'round_robin_availability' | 'hybrid'
  min_notice_hours?: number
  max_notice_days?: number | null
  buffer_before_min?: number
  buffer_after_min?: number
  price_presencial?: number | null
  price_virtual?: number | null
}

interface BookingWizardProps {
  orgName: string
  orgSlug: string
  orgId: string
  doctors: DoctorOption[]
  locations: LocationOption[]
  schedules: ScheduleOption[]
  formFields: FormField[]
  appointmentType?: AppointmentTypeOption
  orgPrimaryColor?: string
  orgLogoUrl?: string | null
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

function generateSlots(startTime: string, endTime: string, durationMin: number): string[] {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const start = sh * 60 + sm
  const end   = eh * 60 + em
  const slots: string[] = []
  for (let t = start; t + durationMin <= end; t += durationMin) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
  }
  return slots
}

function buildCalendarGrid(year: number, month: number): (string | null)[] {
  const firstDay      = new Date(year, month, 1)
  const daysInMonth   = new Date(year, month + 1, 0).getDate()
  const rawDow        = firstDay.getDay()
  const leadingEmpties = rawDow === 0 ? 6 : rawDow - 1
  const grid: (string | null)[] = Array(leadingEmpties).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
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
  minNoticeHours?: number
  maxNoticeDays?: number | null
  bufferBeforeMin?: number
  bufferAfterMin?: number
  durationMinutes: number
  primaryColor?: string
}

function CalendarPicker({
  orgName,
  selectedDoctor,
  effectiveSchedules,
  selectedDate,
  selectedTime,
  onSelect,
  doctorId,
  minNoticeHours = 0,
  maxNoticeDays,
  bufferBeforeMin = 0,
  bufferAfterMin = 0,
  durationMinutes,
  primaryColor = '#215F73',
}: CalendarPickerProps) {
  const today          = todayBogota()
  const minAllowedTime = new Date(Date.now() + minNoticeHours * 3600 * 1000)
  const todayYear      = Number(today.slice(0, 4))
  const todayMonth     = Number(today.slice(5, 7)) - 1

  const [viewYear,     setViewYear]     = useState(todayYear)
  const [viewMonth,    setViewMonth]    = useState(todayMonth)
  const [bookedSlots,  setBookedSlots]  = useState<{ start: string; end: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  const duration    = durationMinutes
  const doctorName  = selectedDoctor ? String(selectedDoctor.metadata?.name ?? 'Médico') : 'Asignación automática'

  useEffect(() => {
    if (!doctorId) { setBookedSlots([]); return }
    setSlotsLoading(true)
    getBookedSlots(doctorId, viewYear, viewMonth)
      .then(setBookedSlots)
      .catch(() => setBookedSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [doctorId, viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const calendarGrid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth])

  function blocksFor(dateStr: string) {
    return doctorId
      ? resolveBlocksForDate(effectiveSchedules, doctorId, dateStr)
      : resolveBlocksForAnyDoctor(effectiveSchedules, dateStr)
  }

  function isDayAvailable(dateStr: string): boolean {
    if (blocksFor(dateStr).length === 0) return false
    if (maxNoticeDays != null) {
      const maxAllowedDate = new Date()
      maxAllowedDate.setDate(maxAllowedDate.getDate() + maxNoticeDays)
      const maxDateStr = maxAllowedDate.toISOString().slice(0, 10)
      if (dateStr > maxDateStr) return false
    }
    return new Date(dateStr + 'T23:59:00') >= minAllowedTime
  }

  function slotsForDay(dateStr: string): string[] {
    const all = new Set<string>()
    blocksFor(dateStr).forEach(b =>
      generateSlots(b.start, b.end, duration).forEach(slot => all.add(slot))
    )
    return Array.from(all)
      .filter(slot => new Date(dateStr + 'T' + slot + ':00') >= minAllowedTime)
      .sort()
  }

  function isSlotBookedOn(dateStr: string, time: string): boolean {
    if (!doctorId) return false
    const slotStart = new Date(`${dateStr}T${time}:00`)
    const slotEnd   = new Date(slotStart.getTime() + duration * 60000)
    return bookedSlots.some(({ start, end }) => {
      const apptStart = new Date(start)
      const apptEnd   = new Date(end)
      const bufferedApptStart = new Date(apptStart.getTime() - bufferBeforeMin * 60000)
      const bufferedApptEnd   = new Date(apptEnd.getTime()   + bufferAfterMin  * 60000)
      return slotStart < bufferedApptEnd && slotEnd > bufferedApptStart
    })
  }

  const slotsForDate = useMemo(
    () => (selectedDate ? slotsForDay(selectedDate) : []),
    [selectedDate, effectiveSchedules, doctorId, duration, minAllowedTime]
  )

  function isSlotBooked(time: string): boolean {
    if (!selectedDate || !doctorId) return false
    return isSlotBookedOn(selectedDate, time)
  }

  // Días donde el médico atiende pero TODOS los cupos están ocupados.
  // No se calcula mientras bookedSlots está cargando, para evitar parpadeo.
  const fullDays = useMemo(() => {
    const set = new Set<string>()
    if (slotsLoading || !doctorId || bookedSlots.length === 0) return set
    calendarGrid.forEach(dateStr => {
      if (!dateStr || dateStr < today) return
      const slots = slotsForDay(dateStr)
      if (slots.length > 0 && slots.every(t => isSlotBookedOn(dateStr, t))) set.add(dateStr)
    })
    return set
  }, [calendarGrid, bookedSlots, slotsLoading, doctorId, effectiveSchedules, duration, minAllowedTime, bufferBeforeMin, bufferAfterMin, today])

  const isPrevDisabled = viewYear === todayYear && viewMonth === todayMonth

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-0">
      <div className={[
        'flex flex-row flex-wrap items-center gap-x-3 gap-y-1 pb-3 border-b',
        'sm:flex-col sm:flex-nowrap sm:items-start sm:w-44 sm:flex-shrink-0 sm:pb-0 sm:border-b-0 sm:border-r sm:pr-5 sm:gap-4',
      ].join(' ')} style={{ borderColor: B.border }}>
        <div className="flex items-center gap-1.5 sm:block">
          <p className="text-xs font-semibold sm:hidden" style={{ color: B.fg }}>{orgName}</p>
          <span className="text-xs sm:hidden" style={{ color: B.border }}>·</span>
          <p className="text-xs font-medium sm:hidden" style={{ color: B.muted }}>{doctorName}</p>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: B.muted }}>Organización</p>
            <p className="font-semibold text-sm" style={{ color: B.fg }}>{orgName}</p>
          </div>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: B.muted }}>Médico</p>
          <p className="font-medium text-sm leading-snug" style={{ color: B.fg }}>{doctorName}</p>
          {selectedDoctor?.specialty && <p className="text-xs mt-0.5" style={{ color: B.muted }}>{selectedDoctor.specialty}</p>}
        </div>
        <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: B.bg, color: primaryColor }}>
          <Clock className="w-3 h-3" />{duration} min
        </div>
        {selectedDate && selectedTime && (
          <div className="hidden sm:block rounded-xl p-3 mt-auto w-full" style={{ background: B.secondary }}>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: B.muted }}>Seleccionado</p>
            <p className="text-xs capitalize" style={{ color: B.muted }}>
              {new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).format(new Date(selectedDate + 'T12:00:00'))}
            </p>
            <p className="text-sm font-bold mt-0.5" style={{ color: B.fg }}>{selectedTime}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-1 sm:pl-5 sm:flex-row sm:gap-5 min-w-0">
        <div className="w-full sm:flex-shrink-0 sm:w-[252px]">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} disabled={isPrevDisabled}
              className="p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition hover:opacity-70">
              <ChevronLeft className="w-4 h-4" style={{ color: B.muted }} />
            </button>
            <span className="text-sm font-semibold text-center" style={{ color: B.fg }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg transition hover:opacity-70">
              <ChevronRight className="w-4 h-4" style={{ color: B.muted }} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(label => (
              <div key={label} className="text-center text-xs font-medium py-1" style={{ color: B.muted }}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calendarGrid.map((dateStr, idx) => {
              if (!dateStr) return <div key={idx} />
              const isToday     = dateStr === today
              const isSelected  = dateStr === selectedDate
              const isPast      = dateStr < today
              const isAvailable = isDayAvailable(dateStr)
              const isFull      = isAvailable && fullDays.has(dateStr)
              const isDisabled  = isPast || !isAvailable || isFull
              return (
                <button key={dateStr} disabled={isDisabled} onClick={() => onSelect(dateStr, '')}
                  title={isFull ? 'Sin cupos disponibles' : undefined}
                  className="relative aspect-square rounded-lg text-xs font-medium transition flex items-center justify-center"
                  style={{
                    background: isSelected ? primaryColor : 'transparent',
                    color:      isSelected ? '#fff'
                                : isPast || !isAvailable ? B.border
                                : isFull ? B.muted
                                : B.fg,
                    outline:    isToday && isAvailable && !isFull && !isSelected ? `2px solid ${B.accent}` : 'none',
                    cursor:     isDisabled ? 'not-allowed' : 'pointer',
                    opacity:    isFull ? 0.6 : 1,
                  }}>
                  {Number(dateStr.slice(8))}
                  {isFull && !isSelected && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full" style={{ background: B.muted }} />
                  )}
                </button>
              )
            })}
          </div>
          {fullDays.size > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px]" style={{ color: B.muted }}>
              <span className="h-1 w-1 rounded-full inline-block" style={{ background: B.muted }} />
              Sin cupos disponibles
            </div>
          )}
        </div>

        {selectedDate && (
          <div className="sm:flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3 capitalize" style={{ color: B.muted }}>
              {new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' }).format(new Date(selectedDate + 'T12:00:00'))}
            </p>
            {slotsLoading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: B.muted }}>
                <div className="w-4 h-4 border-2 border-t-[#215F73] rounded-full animate-spin" style={{ borderColor: B.border, borderTopColor: primaryColor }} />
                Cargando horarios...
              </div>
            ) : slotsForDate.length === 0 ? (
              <p className="text-sm" style={{ color: B.muted }}>No hay horarios disponibles.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-2">
                {slotsForDate.map(time => {
                  const booked   = isSlotBooked(time)
                  const selected = time === selectedTime
                  return (
                    <button key={time} disabled={booked} onClick={() => onSelect(selectedDate, time)}
                      className="rounded-xl px-3 py-2 text-sm font-medium transition text-center"
                      style={{
                        background: selected ? primaryColor : booked ? B.secondary : B.secondary,
                        color:      selected ? '#fff'     : booked ? B.border    : B.fg,
                        textDecoration: booked ? 'line-through' : 'none',
                        cursor:     booked ? 'not-allowed' : 'pointer',
                        border:     selected ? 'none' : `1px solid ${B.border}`,
                      }}>
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

// ── Doctor avatar ─────────────────────────────────────────────────────────────

function DoctorAvatar({ name, photoUrl, color, size = 'md' }: { name: string; photoUrl?: string | null; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const sz = size === 'sm' ? 'h-6 w-6 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm'
  if (photoUrl) return <img src={photoUrl} alt={name} className={`${sz} rounded-full object-cover shrink-0`} />
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0`} style={{ backgroundColor: color }}>
      {initials || '?'}
    </div>
  )
}

// ── BookingWizard ─────────────────────────────────────────────────────────────

export default function BookingWizard({
  orgName, orgSlug, orgId, doctors, locations, schedules, formFields, appointmentType,
  orgPrimaryColor, orgLogoUrl,
}: BookingWizardProps) {
  const primaryColor = orgPrimaryColor ?? '#215F73'
  const typeColor = appointmentType?.color ?? primaryColor

  const fixedModality: 'presencial' | 'virtual' | null =
    appointmentType?.modality === 'presencial' ? 'presencial' :
    appointmentType?.modality === 'virtual'    ? 'virtual'    : null

  const showModalityChoice = appointmentType?.modality === 'patient_choice' || !appointmentType?.modality

  const assignedIds      = appointmentType?.doctor_ids?.length ? appointmentType.doctor_ids : null
  const availableDoctors = doctors.filter(d => d.is_active && (assignedIds === null || assignedIds.includes(d.id)))

  const showDoctorSection =
    (appointmentType?.assignment_mode === 'hybrid' ||
     appointmentType?.assignment_mode === 'one_on_one' ||
     !appointmentType?.assignment_mode) &&
    availableDoctors.length >= 2

  const skipStep1 = !showModalityChoice && !showDoctorSection
  const stepOrder: number[] = skipStep1 ? [2, 3, 4] : [1, 2, 3, 4]

  const [currentStep, setCurrentStep] = useState(stepOrder[0])

  const [formData, setFormData] = useState({
    modality: (fixedModality ?? 'presencial') as 'presencial' | 'virtual',
    doctor_id: '',
    location_id: locations.length === 1 ? locations[0].id : '',
    date: '',
    time: '',
    patient_first_name: '',
    patient_last_name:  '',
    phone:   '',
    email:   '',
    cedula:  '',
    id_type: '',
    customFields: {} as Record<string, string>,
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedDoctor = useMemo(
    () => availableDoctors.find(d => d.id === formData.doctor_id) ?? null,
    [availableDoctors, formData.doctor_id]
  )

  const effectiveSchedules = useMemo(
    () => formData.doctor_id ? schedules.filter(s => s.doctor_id === formData.doctor_id) : schedules,
    [schedules, formData.doctor_id]
  )

  // Pre-select the only doctor when exactly one is assigned
  useEffect(() => {
    if (availableDoctors.length === 1 && !formData.doctor_id) {
      setFormData(p => ({ ...p, doctor_id: availableDoctors[0].id }))
    }
  }, [availableDoctors])

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
          modality:            formData.modality,
          doctor_id:           formData.doctor_id || null,
          location_id:         formData.location_id || null,
          date:                formData.date,
          time:                formData.time,
          patient_first_name:  formData.patient_first_name,
          patient_last_name:   formData.patient_last_name,
          phone:               formData.phone,
          email:               formData.email,
          cedula:              formData.cedula,
          custom_fields:       { ...formData.customFields, 'tipo-identificacion': formData.id_type },
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

  // ── Step indicator ────────────────────────────────────────────────────────

  const INDICATOR_LABELS = skipStep1
    ? ['Fecha', 'Confirmación']
    : ['Preferencias', 'Fecha', 'Confirmación']
  const totalSteps = INDICATOR_LABELS.length
  const visualPos  = skipStep1 ? currentStep - 1 : currentStep

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {INDICATOR_LABELS.map((label, idx) => {
        const pos    = idx + 1
        const active = pos <= Math.min(visualPos, totalSteps)
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
                style={{ background: active ? primaryColor : '#e5e7eb', color: active ? '#fff' : B.muted }}>
                {pos}
              </div>
              <span className="hidden sm:block text-[11px] font-medium" style={{ color: active ? primaryColor : B.muted }}>{label}</span>
            </div>
            {idx < INDICATOR_LABELS.length - 1 && (
              <div className="w-6 sm:w-10 h-0.5 mx-1 sm:mx-2 mb-4 transition-colors"
                style={{ background: pos < visualPos ? B.accent : '#e5e7eb' }} />
            )}
          </div>
        )
      })}
    </div>
  )

  // ── Step 1 — Preferencias ─────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold" style={{ color: B.fg }}>¿Cómo prefieres tu cita?</h2>
        <p className="mt-1 text-sm" style={{ color: B.muted }}>Elige la modalidad y, si quieres, un médico específico</p>
      </div>

      {/* Modalidad */}
      {showModalityChoice && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { value: 'presencial', Icon: Building, label: 'Presencial', sub: locations.length === 1 && formData.modality === 'presencial' ? locations[0].name : 'En el consultorio' },
            { value: 'virtual',    Icon: Video,    label: 'Virtual',    sub: 'Videollamada' },
          ].map(({ value, Icon, label, sub }) => {
            const active = formData.modality === value
            return (
              <button key={value}
                onClick={() => setFormData(p => ({ ...p, modality: value as 'presencial' | 'virtual' }))}
                className="flex items-center gap-3 rounded-2xl p-4 text-left transition"
                style={{
                  border:     `${active ? 2 : 0.5}px solid ${active ? primaryColor : B.border}`,
                  background: active ? B.bg : B.secondary,
                }}>
                <div className="shrink-0 rounded-xl p-2" style={{ background: active ? primaryColor : B.border }}>
                  <Icon className="h-5 w-5" style={{ color: active ? '#fff' : B.muted }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: B.fg }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: B.muted }}>{sub}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Sede */}
      {formData.modality === 'presencial' && locations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: B.muted }}>
            📍 Sede
          </p>
          {locations.length === 1 ? (
            <div className="flex items-center gap-3 px-1">
              <Building className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: B.fg }}>{locations[0].name}</p>
                {locations[0].address && (
                  <p className="text-xs mt-0.5" style={{ color: B.muted }}>{locations[0].address}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map(loc => {
                const isActive = formData.location_id === loc.id
                return (
                  <button key={loc.id}
                    onClick={() => setFormData(p => ({ ...p, location_id: loc.id }))}
                    className="w-full flex items-center gap-3 rounded-2xl p-4 text-left transition"
                    style={{
                      border: `${isActive ? 2 : 0.5}px solid ${isActive ? primaryColor : B.border}`,
                      background: isActive ? B.bg : B.secondary,
                    }}>
                    <div className="shrink-0 rounded-xl p-2" style={{ background: isActive ? primaryColor : B.border }}>
                      <Building className="h-4 w-4" style={{ color: isActive ? '#fff' : B.muted }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: B.fg }}>{loc.name}</p>
                      {loc.address && (
                        <p className="text-xs mt-0.5" style={{ color: B.muted }}>{loc.address}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Doctor selection */}
      {showDoctorSection && (
        <div className="space-y-3">
          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: B.border }} />
            <span className="text-xs font-medium" style={{ color: B.muted }}>¿Tienes preferencia de médico?</span>
            <div className="flex-1 h-px" style={{ background: B.border }} />
          </div>

          {/* Auto-assign card */}
          <button
            onClick={() => setFormData(p => ({ ...p, doctor_id: '', date: '', time: '' }))}
            className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition"
            style={{
              border:     `${formData.doctor_id === '' ? 2 : 0.5}px solid ${formData.doctor_id === '' ? primaryColor : B.border}`,
              background: formData.doctor_id === '' ? B.bg : B.secondary,
            }}>
            <div className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center" style={{ background: primaryColor }}>
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold" style={{ color: B.fg }}>Primer médico disponible</p>
              <p className="text-sm mt-0.5" style={{ color: B.muted }}>Te asignamos el que tenga el turno más próximo</p>
            </div>
          </button>

          {/* Doctor grid — always visible */}
          {availableDoctors.length > 0 && (
            <div>
              <p style={{ fontSize: 12, color: B.muted, marginBottom: 12 }}>O elige un médico específico</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableDoctors.map(doc => {
                  const name     = String(doc.metadata?.name ?? 'Médico')
                  const photoUrl = doc.metadata?.photo_url as string | null | undefined
                  const isActive = formData.doctor_id === doc.id
                  return (
                    <button key={doc.id}
                      onClick={() => setFormData(p => ({ ...p, doctor_id: doc.id, date: '', time: '' }))}
                      className="flex items-center gap-3 rounded-2xl p-3 text-left transition"
                      style={{
                        border:     `${isActive ? 2 : 0.5}px solid ${isActive ? primaryColor : B.border}`,
                        background: isActive ? B.bg : B.secondary,
                      }}>
                      <DoctorAvatar name={name} photoUrl={photoUrl} color={typeColor} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: B.fg }}>{name}</p>
                        {doc.specialty && <p className="text-xs mt-0.5 truncate" style={{ color: B.muted }}>{doc.specialty}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── Step 2 — Fecha y hora ─────────────────────────────────────────────────

  const renderStep2 = () => {
    const docName  = selectedDoctor ? String(selectedDoctor.metadata?.name ?? 'Médico') : null
    const photoUrl = selectedDoctor?.metadata?.photo_url as string | null | undefined
    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: B.fg }}>Fecha y hora</h2>
          {docName && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: B.secondary, border: `1px solid ${B.border}` }}>
              <DoctorAvatar name={docName} photoUrl={photoUrl} color={typeColor} size="sm" />
              <span className="text-sm font-medium" style={{ color: B.fg }}>{docName}</span>
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
          maxNoticeDays={appointmentType?.max_notice_days ?? null}
          bufferBeforeMin={appointmentType?.buffer_before_min ?? 0}
          bufferAfterMin={appointmentType?.buffer_after_min ?? 0}
          durationMinutes={appointmentType?.duration_minutes ?? 60}
          primaryColor={primaryColor}
        />
      </div>
    )
  }

  // ── Step 3 — Tus datos ────────────────────────────────────────────────────

  const renderStep3 = () => {
    const docName  = selectedDoctor ? String(selectedDoctor.metadata?.name ?? 'Médico') : 'Asignación automática'
    const photoUrl = selectedDoctor?.metadata?.photo_url as string | null | undefined
    const canSubmit = !loading && !!formData.patient_first_name && !!formData.patient_last_name && !!formData.phone && !!formData.email && !!formData.cedula && !!formData.id_type

    const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2`
    const inputStyle = { border: `1px solid ${B.border}`, background: '#fff', color: B.fg }
    const inputFocusRing = { '--tw-ring-color': B.accent } as React.CSSProperties

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold" style={{ color: B.fg }}>Tus datos</h2>
        </div>

        {/* Summary */}
        <div className="rounded-2xl px-5 py-4 space-y-2.5 text-sm" style={{ background: B.secondary, border: `1px solid ${B.border}` }}>
          {appointmentType && (
            <div className="flex justify-between">
              <span style={{ color: B.muted }}>Tipo</span>
              <span className="font-medium" style={{ color: B.fg }}>{appointmentType.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span style={{ color: B.muted }}>Médico</span>
            <div className="flex items-center gap-1.5">
              {selectedDoctor && <DoctorAvatar name={docName} photoUrl={photoUrl} color={typeColor} size="sm" />}
              <span className="font-medium" style={{ color: B.fg }}>{docName}</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span style={{ color: B.muted }}>Fecha</span>
            <span className="font-medium" style={{ color: B.fg }}>
              {formData.date
                ? new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).format(new Date(formData.date + 'T12:00:00'))
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: B.muted }}>Hora</span>
            <span className="font-medium" style={{ color: B.fg }}>{formData.time || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: B.muted }}>Modalidad</span>
            <span className="font-medium" style={{ color: B.fg }}>{formData.modality === 'presencial' ? 'Presencial' : 'Virtual'}</span>
          </div>
          {(() => {
            const price = formData.modality === 'virtual'
              ? appointmentType?.price_virtual
              : appointmentType?.price_presencial
            if (!price || price <= 0) return null
            return (
              <div className="flex justify-between items-start">
                <span style={{ color: B.muted }}>Valor</span>
                <div className="text-right">
                  <span className="font-medium" style={{ color: B.fg }}>
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price)}
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: B.muted }}>
                    {formData.modality === 'virtual'
                      ? 'Te enviaremos los detalles de pago y el enlace de la consulta por email'
                      : 'Se paga en el consultorio'}
                  </p>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Patient form */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: B.fg }}>Nombre *</label>
            <input type="text" value={formData.patient_first_name}
              onChange={e => setFormData(p => ({ ...p, patient_first_name: e.target.value }))}
              className={inputCls} style={{ ...inputStyle, ...inputFocusRing }} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: B.fg }}>Apellido *</label>
            <input type="text" value={formData.patient_last_name}
              onChange={e => setFormData(p => ({ ...p, patient_last_name: e.target.value }))}
              className={inputCls} style={{ ...inputStyle, ...inputFocusRing }} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: B.fg }}>Teléfono *</label>
            <input type="tel" value={formData.phone}
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              className={inputCls} style={{ ...inputStyle, ...inputFocusRing }} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: B.fg }}>Email *</label>
            <input type="email" value={formData.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              className={inputCls} style={{ ...inputStyle, ...inputFocusRing }} required />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: B.fg }}>Tipo de Identificación *</label>
            <select value={formData.id_type}
              onChange={e => setFormData(p => ({ ...p, id_type: e.target.value }))}
              className={inputCls} style={{ ...inputStyle, ...inputFocusRing }} required>
              <option value="">Selecciona una opción</option>
              <option value="Cédula de ciudadanía">Cédula de ciudadanía</option>
              <option value="Cédula de extranjería">Cédula de extranjería</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="Tarjeta de identidad">Tarjeta de identidad</option>
              <option value="Registro civil">Registro civil</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: B.fg }}>Número de Identificación *</label>
            <input type="text" value={formData.cedula}
              onChange={e => setFormData(p => ({ ...p, cedula: e.target.value }))}
              className={inputCls} style={{ ...inputStyle, ...inputFocusRing }} required />
          </div>
          {formFields.map(field => (
            <div key={field.field_name} className={field.field_type === 'textarea' || field.field_type === 'text' ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium mb-2" style={{ color: B.fg }}>
                {field.field_label ?? field.field_name} {field.required ? '*' : ''}
              </label>
              {field.field_type === 'textarea' ? (
                <textarea value={formData.customFields[field.field_name] || ''}
                  onChange={e => setFormData(p => ({ ...p, customFields: { ...p.customFields, [field.field_name]: e.target.value } }))}
                  placeholder={field.placeholder} rows={3}
                  className={`${inputCls} resize-none`} style={{ ...inputStyle, ...inputFocusRing }} required={field.required} />
              ) : field.field_type === 'select' ? (
                <select value={formData.customFields[field.field_name] || ''}
                  onChange={e => setFormData(p => ({ ...p, customFields: { ...p.customFields, [field.field_name]: e.target.value } }))}
                  className={inputCls} style={{ ...inputStyle, ...inputFocusRing }} required={field.required}>
                  <option value="">Selecciona una opción</option>
                  {(field.options ?? []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.field_type === 'date' ? (
                <DatePicker
                  value={formData.customFields[field.field_name] || ''}
                  onChange={(d) => setFormData(p => ({ ...p, customFields: { ...p.customFields, [field.field_name]: d } }))}
                  placeholder={field.placeholder || 'Seleccionar fecha'}
                />
              ) : (
                <input type={field.field_type} value={formData.customFields[field.field_name] || ''}
                  onChange={e => setFormData(p => ({ ...p, customFields: { ...p.customFields, [field.field_name]: e.target.value } }))}
                  placeholder={field.placeholder}
                  className={inputCls} style={{ ...inputStyle, ...inputFocusRing }} required={field.required} />
              )}
            </div>
          ))}
        </div>

        {/* Confirm */}
        <button onClick={handleSubmit} disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: canSubmit ? primaryColor : B.muted }}>
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Agendando...</>
            : <><UserPlus className="w-4 h-4" /> Confirmar cita</>}
        </button>
      </div>
    )
  }

  // ── Step 4 — Success / Error ──────────────────────────────────────────────

  const renderStep4 = () => {
    if (success) {
      return (
        <div className="text-center space-y-6">
          <CheckCircle className="w-16 h-16 mx-auto" style={{ color: primaryColor }} />
          <h2 className="text-2xl font-bold" style={{ color: B.fg }}>¡Cita agendada!</h2>
          <p style={{ color: B.muted }}>Recibirás una confirmación por email.</p>
          <div className="rounded-2xl p-6 text-left space-y-3 text-sm" style={{ background: B.secondary, border: `1px solid ${B.border}` }}>
            <p className="font-semibold text-base mb-1" style={{ color: B.fg }}>Resumen</p>
            {[
              { label: 'Médico',    value: selectedDoctor ? String(selectedDoctor.metadata?.name ?? 'Asignado automáticamente') : 'Asignado automáticamente' },
              { label: 'Fecha',     value: new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' }).format(new Date(formData.date + 'T12:00:00')) },
              { label: 'Hora',      value: formData.time },
              { label: 'Modalidad', value: formData.modality === 'presencial' ? 'Presencial' : 'Virtual' },
              { label: 'Paciente',  value: [formData.patient_first_name, formData.patient_last_name].filter(Boolean).join(' ') },
            ].map(({ label, value }, i, arr) => (
              <div key={label} className={`flex justify-between ${i < arr.length - 1 ? 'pb-2' : ''}`}
                style={i < arr.length - 1 ? { borderBottom: `1px solid ${B.border}` } : {}}>
                <span style={{ color: B.muted }}>{label}</span>
                <span className="font-medium" style={{ color: B.fg }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#fee2e2' }}>
          <XCircle className="w-8 h-8" style={{ color: '#dc3545' }} />
        </div>
        <h2 className="text-2xl font-bold" style={{ color: B.fg }}>No se pudo agendar</h2>
        <div className="rounded-xl px-4 py-3 text-sm text-left" style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#dc3545' }}>
          <p className="font-semibold mb-1">Error</p>
          <p>{error || 'Error desconocido. Intenta de nuevo.'}</p>
        </div>
        <button onClick={() => { setError(null); goPrev() }}
          className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-medium transition"
          style={{ background: primaryColor }}>
          <ArrowLeft className="w-4 h-4" />
          Volver e intentar de nuevo
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const step2Ready = currentStep !== 2 || (!!formData.date && !!formData.time)

  return (
    <>
    <div className="mx-auto max-w-4xl">
      <div className="rounded-2xl sm:rounded-3xl shadow-sm p-5 sm:p-6" style={{ background: '#fff', border: `1px solid ${B.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 px-4 sm:px-8">
          <div>
            {orgLogoUrl
              ? <img src={orgLogoUrl} alt={orgName} className="h-20 w-auto object-contain" />
              : <h1 className="text-xl font-bold" style={{ color: B.fg }}>{orgName}</h1>
            }
          </div>
          {currentStep < 4 && (
            <div className="flex items-center">
              {INDICATOR_LABELS.map((label, idx) => {
                const pos    = idx + 1
                const active = pos <= Math.min(visualPos, totalSteps)
                return (
                  <div key={label} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
                        style={{ background: active ? primaryColor : '#e5e7eb', color: active ? '#fff' : B.muted }}>
                        {pos}
                      </div>
                      <span className="hidden sm:block text-[11px] font-medium" style={{ color: active ? primaryColor : B.muted }}>{label}</span>
                    </div>
                    {idx < INDICATOR_LABELS.length - 1 && (
                      <div className="w-6 sm:w-10 h-0.5 mx-1 sm:mx-2 mb-4 transition-colors"
                        style={{ background: pos < visualPos ? B.accent : '#e5e7eb' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="min-h-[420px]">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {currentStep < 3 && (
          <div className="flex justify-between mt-8">
            {currentStep > stepOrder[0] ? (
              <button onClick={goPrev}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ border: `1px solid ${B.border}`, color: B.fg, background: '#fff' }}>
                <ArrowLeft className="w-4 h-4" /> Anterior
              </button>
            ) : <div />}
            <button onClick={goNext} disabled={!step2Ready}
              className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-medium ml-auto transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: primaryColor }}>
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {currentStep === 3 && (
          <div className="mt-8">
            <button onClick={goPrev}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition"
              style={{ border: `1px solid ${B.border}`, color: B.fg, background: '#fff' }}>
              <ArrowLeft className="w-4 h-4" /> Anterior
            </button>
          </div>
        )}
      </div>
    </div>
    <div className="text-center mt-4 pb-6">
      <a
        href="https://medscale.app"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium transition hover:opacity-80"
        style={{ color: '#94a3b8' }}
      >
        <span>Powered by</span>
        <span className="font-bold tracking-tight" style={{ color: '#215F73' }}>MedScale AI</span>
      </a>
    </div>
    </>
  )
}
