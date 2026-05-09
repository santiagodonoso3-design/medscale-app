'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBookedSlots } from '@/app/actions/booking'
import { X, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react'

// ── Calendar utilities (mirrors booking-wizard) ───────────────────────────────

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}
function toSupabaseDay(jsDay: number): number { return jsDay === 0 ? 7 : jsDay }
function generateSlots(start: string, end: string, dur: number): string[] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const s = sh * 60 + sm, e = eh * 60 + em
  const out: string[] = []
  for (let t = s; t + dur <= e; t += dur)
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
  return out
}
function buildCalendarGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const days  = new Date(year, month + 1, 0).getDate()
  const lead  = first.getDay() === 0 ? 6 : first.getDay() - 1
  const grid: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++)
    grid.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_LABELS  = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

// ── Types ─────────────────────────────────────────────────────────────────────

interface DoctorRow {
  id: string
  metadata: { name?: string; default_duration?: number; duration?: number } | null
}
interface ScheduleRow {
  id: string; doctor_id: string; day_of_week: number; start_time: string; end_time: string
}
export interface BookLead {
  id: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_cedula: string | null
}

interface Props {
  isOpen:    boolean
  onClose:   () => void
  onSuccess: () => void
  lead:      BookLead
  orgId:     string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BookAppointmentModal({ isOpen, onClose, onSuccess, lead, orgId }: Props) {
  const supabase = createClient()
  const today      = todayBogota()
  const todayYear  = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7)) - 1

  const [doctors,    setDoctors]    = useState<DoctorRow[]>([])
  const [schedules,  setSchedules]  = useState<ScheduleRow[]>([])
  const [loadingDrs, setLoadingDrs] = useState(false)

  const [doctorId,     setDoctorId]     = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [viewYear,     setViewYear]     = useState(todayYear)
  const [viewMonth,    setViewMonth]    = useState(todayMonth)
  const [bookedSlots,  setBookedSlots]  = useState<{ start: string; end: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Load doctors + all their schedules when modal opens
  useEffect(() => {
    if (!isOpen) return
    setDoctorId(''); setSelectedDate(''); setSelectedTime(''); setError(null)
    setViewYear(todayYear); setViewMonth(todayMonth)
    setLoadingDrs(true)

    supabase.from('doctors')
      .select('id, metadata')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .then(async ({ data: drs }) => {
        const docs = drs ?? []
        setDoctors(docs)
        if (docs.length > 0) {
          const { data: schs } = await supabase.from('schedules')
            .select('id, doctor_id, day_of_week, start_time, end_time')
            .in('doctor_id', docs.map(d => d.id))
            .eq('is_recurring', true).eq('active', true)
          setSchedules(schs ?? [])
        }
        setLoadingDrs(false)
      })
  }, [isOpen, orgId])

  // Load booked slots when doctor or month changes
  useEffect(() => {
    if (!doctorId || !isOpen) return
    setSlotsLoading(true)
    getBookedSlots(doctorId, viewYear, viewMonth)
      .then(setBookedSlots).catch(() => setBookedSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [doctorId, viewYear, viewMonth, isOpen])

  const selectedDoctor = useMemo(() => doctors.find(d => d.id === doctorId) ?? null, [doctors, doctorId])
  const duration       = Number(selectedDoctor?.metadata?.duration || selectedDoctor?.metadata?.default_duration || 30)
  const doctorScheds   = useMemo(() => doctorId ? schedules.filter(s => s.doctor_id === doctorId) : schedules, [schedules, doctorId])
  const availableDays  = useMemo(() => { const s = new Set<number>(); doctorScheds.forEach(x => s.add(Number(x.day_of_week))); return s }, [doctorScheds])
  const calGrid        = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return []
    const sdDay   = toSupabaseDay(new Date(selectedDate + 'T12:00:00').getDay())
    const matching = doctorScheds.filter(s => Number(s.day_of_week) === sdDay)
    const all = new Set<string>()
    matching.forEach(s => generateSlots(s.start_time, s.end_time, duration).forEach(sl => all.add(sl)))
    return Array.from(all).sort()
  }, [selectedDate, doctorScheds, duration])

  function isDayAvailable(d: string) {
    if (d < today) return false
    return availableDays.has(toSupabaseDay(new Date(d + 'T12:00:00').getDay()))
  }
  function isSlotBooked(t: string) {
    return doctorId ? bookedSlots.some(b => b.start.startsWith(`${selectedDate}T${t}:`)) : false
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1)
  }

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !doctorId) return
    setSaving(true); setError(null)
    try {
      const { data: locs } = await supabase.from('locations')
        .select('id').eq('organization_id', orgId).limit(1)
      const locationId  = locs?.[0]?.id ?? null
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00.000Z`)
      const endsAt      = new Date(scheduledAt.getTime() + duration * 60000)

      const { error: err } = await supabase.from('appointments').insert({
        organization_id:      orgId,
        doctor_id:            doctorId,
        location_id:          locationId,
        lead_id:              lead.id,
        scheduled_at:         scheduledAt.toISOString(),
        ends_at:              endsAt.toISOString(),
        status:               'scheduled',
        notes:                null,
        external_calendar_id: null,
      })
      if (err) { setError(err.message); setSaving(false); return }
      onSuccess()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  if (!isOpen) return null

  const isPrevDisabled = viewYear === todayYear && viewMonth === todayMonth
  const canConfirm     = !!selectedDate && !!selectedTime && !!doctorId && !saving

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Nueva cita</h2>
            <p className="mt-0.5 text-xs text-slate-500">{lead.contact_name || 'Sin nombre'}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Doctor */}
          {loadingDrs ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando médicos...
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Médico *</label>
              <select value={doctorId}
                onChange={e => { setDoctorId(e.target.value); setSelectedDate(''); setSelectedTime('') }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona un médico</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{String(d.metadata?.name ?? 'Médico')}</option>
                ))}
              </select>
            </div>
          )}

          {/* Calendar + slots */}
          {doctorId && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Fecha y hora
                {duration > 0 && <span className="ml-1 font-normal text-slate-300">· {duration} min</span>}
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">

                {/* Calendar grid */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={prevMonth} disabled={isPrevDisabled}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold text-slate-700">
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </span>
                    <button onClick={nextMonth}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {DAY_LABELS.map(d => (
                      <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase text-slate-400">{d}</div>
                    ))}
                    {calGrid.map((dateStr, i) => {
                      if (!dateStr) return <div key={i} />
                      const avail    = isDayAvailable(dateStr)
                      const isToday  = dateStr === today
                      const selected = dateStr === selectedDate
                      return (
                        <button key={dateStr}
                          onClick={() => { if (avail) { setSelectedDate(dateStr); setSelectedTime('') } }}
                          disabled={!avail}
                          className={[
                            'aspect-square rounded-lg text-xs font-medium transition',
                            selected  ? 'bg-blue-600 text-white shadow-sm' :
                            isToday   ? 'bg-blue-50 text-blue-700 font-bold' :
                            avail     ? 'text-slate-800 hover:bg-slate-100' :
                                        'text-slate-300 cursor-default',
                          ].join(' ')}>
                          {Number(dateStr.slice(8))}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Time slots */}
                <div className="sm:w-32">
                  {!selectedDate ? (
                    <p className="text-xs text-slate-400 pt-2">Elige una fecha</p>
                  ) : slotsLoading ? (
                    <div className="flex items-center gap-1.5 pt-2 text-xs text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                    </div>
                  ) : slotsForDate.length === 0 ? (
                    <p className="text-xs text-slate-400 pt-2">Sin horarios</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-1 max-h-52 overflow-y-auto pr-0.5">
                      {slotsForDate.map(time => {
                        const booked   = isSlotBooked(time)
                        const selected = time === selectedTime
                        return (
                          <button key={time} onClick={() => !booked && setSelectedTime(time)} disabled={booked}
                            className={[
                              'rounded-lg py-2 text-xs font-medium border transition text-center',
                              selected ? 'bg-blue-600 text-white border-blue-600' :
                              booked   ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' :
                                         'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-700',
                            ].join(' ')}>
                            {time}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <button onClick={handleConfirm} disabled={!canConfirm}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40">
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Check className="h-4 w-4" />}
            {selectedDate && selectedTime
              ? `Confirmar — ${selectedDate} a las ${selectedTime}`
              : 'Selecciona médico, fecha y hora'}
          </button>
        </div>

      </div>
    </div>
  )
}
