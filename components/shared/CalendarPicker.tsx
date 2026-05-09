'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { getBookedSlots } from '@/app/actions/booking'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DoctorMeta {
  name?: string | null
  default_duration?: number | null
  duration?: number | null
  [key: string]: unknown
}

export interface DoctorOption {
  id: string
  specialty: string | null
  is_active: boolean
  metadata: DoctorMeta | null
}

export interface ScheduleOption {
  id: string
  doctor_id: string
  location_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

export interface CalendarPickerTexts {
  org: string
  doctor: string
  autoAssign: string
  selected: string
  loading: string
  noSlots: string
  docFallback: string
}

export interface CalendarPickerProps {
  orgName: string
  selectedDoctor: DoctorOption | null
  effectiveSchedules: ScheduleOption[]
  selectedDate: string
  selectedTime: string
  onSelect: (date: string, time: string) => void
  doctorId: string
  durationOverride?: number
  minNoticeHours?: number
  bufferBeforeMin?: number
  bufferAfterMin?: number
  texts: CalendarPickerTexts
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

export function toSupabaseDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay
}

export function generateSlots(startTime: string, endTime: string, durationMin: number): string[] {
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

export function buildCalendarGrid(year: number, month: number): (string | null)[] {
  const firstDay     = new Date(year, month, 1)
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const rawDow       = firstDay.getDay()
  const leadingEmpty = rawDow === 0 ? 6 : rawDow - 1
  const grid: (string | null)[] = Array(leadingEmpty).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CalendarPicker({
  orgName,
  selectedDoctor,
  effectiveSchedules,
  selectedDate,
  selectedTime,
  onSelect,
  doctorId,
  minNoticeHours = 0,
  bufferBeforeMin,
  bufferAfterMin,
  texts,
}: CalendarPickerProps) {
  const today          = todayBogota()
  const minAllowedTime = new Date(Date.now() + minNoticeHours * 3600 * 1000)
  const todayYear      = Number(today.slice(0, 4))
  const todayMonth     = Number(today.slice(5, 7)) - 1

  const [viewYear,     setViewYear]     = useState(todayYear)
  const [viewMonth,    setViewMonth]    = useState(todayMonth)
  const [bookedSlots,  setBookedSlots]  = useState<{ start: string; end: string }[]>([])
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

  const availableSupabaseDays = useMemo(() => {
    const set = new Set<number>()
    effectiveSchedules.forEach(s => set.add(Number(s.day_of_week)))
    return set
  }, [effectiveSchedules])

  function isDayAvailable(dateStr: string): boolean {
    const supabaseDay = toSupabaseDay(new Date(dateStr + 'T12:00:00').getDay())
    if (!availableSupabaseDays.has(supabaseDay)) return false
    return new Date(dateStr + 'T23:59:00') >= minAllowedTime
  }

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return []
    const supabaseDay = toSupabaseDay(new Date(selectedDate + 'T12:00:00').getDay())
    const matching    = effectiveSchedules.filter(s => s.day_of_week === supabaseDay)
    const all         = new Set<string>()
    matching.forEach(s => generateSlots(s.start_time, s.end_time, duration).forEach(slot => all.add(slot)))
    return Array.from(all)
      .filter(slot => new Date(selectedDate + 'T' + slot + ':00') >= minAllowedTime)
      .sort()
  }, [selectedDate, effectiveSchedules, duration, minAllowedTime])

  function isSlotBooked(time: string): boolean {
    if (!selectedDate || !doctorId) return false
    const bufferBefore = bufferBeforeMin ?? 0
    const bufferAfter = bufferAfterMin ?? 0

    // Work with minutes since midnight to avoid timezone issues
    const [slotH, slotM] = time.split(':').map(Number)
    const slotStartMin = slotH * 60 + slotM
    const slotEndMin = slotStartMin + duration

    return bookedSlots.some(({ start, end }) => {
      // start and end are already in Bogota format: "2026-05-14T13:00:00"
      const startDate = start.slice(0, 10)
      if (startDate !== selectedDate) return false

      const [aptH, aptM] = start.slice(11, 16).split(':').map(Number)
      const [endH, endM] = end.slice(11, 16).split(':').map(Number)

      const aptStartMin = aptH * 60 + aptM - bufferBefore
      const aptEndMin = endH * 60 + endM + bufferAfter

      return slotStartMin < aptEndMin && slotEndMin > aptStartMin
    })
  }

  const isPrevDisabled = viewYear === todayYear && viewMonth === todayMonth

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-0">
      <div className={[
        'hidden sm:flex flex-col flex-nowrap items-start w-44 flex-shrink-0 border-r border-gray-100 pr-5 gap-4',
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
          {selectedDoctor?.specialty && <p className="text-xs text-gray-500 mt-0.5">{selectedDoctor.specialty}</p>}
          {!selectedDoctor && <p className="text-xs text-gray-400 mt-0.5">{texts.autoAssign}</p>}
        </div>
        <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 text-xs font-semibold">
          <Clock className="w-3 h-3" />{duration} min
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
            {DAY_LABELS.map(label => (
              <div key={label} className="text-center text-xs font-medium text-gray-400 py-1">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calendarGrid.map((dateStr, idx) => {
              if (!dateStr) return <div key={idx} />
              const isToday     = dateStr === today
              const isSelected  = dateStr === selectedDate
              const isPast      = dateStr < today
              const isAvailable = isDayAvailable(dateStr)
              return (
                <button key={dateStr} disabled={isPast || !isAvailable} onClick={() => onSelect(dateStr, '')}
                  className={[
                    'aspect-square rounded-lg text-xs font-medium transition flex items-center justify-center',
                    isSelected ? 'bg-blue-600 text-white' :
                    isToday && isAvailable ? 'ring-2 ring-blue-400 text-blue-700' :
                    isPast || !isAvailable ? 'text-gray-200 cursor-not-allowed' :
                    'hover:bg-blue-50 text-gray-700',
                  ].join(' ')}>
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
              <div className="grid grid-cols-2 gap-2">
                {slotsForDate.map(time => {
                  const booked   = isSlotBooked(time)
                  const selected = time === selectedTime
                  return (
                    <button key={time} disabled={booked} onClick={() => onSelect(selectedDate, time)}
                      className={[
                        'rounded-xl px-3 py-2 text-sm font-medium transition text-center',
                        selected ? 'bg-blue-600 text-white' :
                        booked   ? 'bg-gray-50 text-gray-300 cursor-not-allowed line-through' :
                                   'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                      ].join(' ')}>
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
