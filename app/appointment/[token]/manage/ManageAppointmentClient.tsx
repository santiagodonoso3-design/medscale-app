'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ScheduleOption } from '@/components/shared/CalendarPicker'
import { getBookedSlots } from '@/app/actions/booking'
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const B = {
  primary: '#215F73',
  fg:      '#0D2B3E',
  muted:   '#4A6B7A',
  bg:      '#EBF0F6',
  border:  '#C8D8E4',
  card:    '#FFFFFF',
  sec:     '#F3F7FA',
  danger:  '#DC3545',
}

interface Apt {
  id: string
  scheduled_at: string
  ends_at: string | null
  status: string
  notes: string | null
  manage_token: string
  doctor: { id: string; metadata: Record<string, unknown> | null } | null
  lead: { contact_name: string | null; contact_last_name: string | null; contact_email: string | null } | null
  organization: { name: string; slug: string } | null
  location: { name: string; address: string | null } | null
}

interface Props {
  appointment: Apt
  token: string
  schedules: ScheduleOption[]
}

// ── Inline calendar ───────────────────────────────────────────────────────────

const DAY_LABELS   = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTH_NAMES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}
function toDBDay(jsDay: number) { return jsDay === 0 ? 7 : jsDay }

function buildGrid(year: number, month: number): (string | null)[] {
  const first  = new Date(year, month, 1)
  const days   = new Date(year, month + 1, 0).getDate()
  const lead   = first.getDay() === 0 ? 6 : first.getDay() - 1
  const grid: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) grid.push(`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
  while (grid.length % 7) grid.push(null)
  return grid
}

function genSlots(start: string, end: string, dur: number): string[] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const s = sh*60+sm, e = eh*60+em
  const out: string[] = []
  for (let t = s; t+dur <= e; t += dur)
    out.push(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`)
  return out
}

interface MiniCalProps {
  doctorId: string
  schedules: ScheduleOption[]
  duration: number
  selectedDate: string
  selectedTime: string
  onSelect: (d: string, t: string) => void
}

function MiniCal({ doctorId, schedules, duration, selectedDate, selectedTime, onSelect }: MiniCalProps) {
  const today = todayStr()
  const [viewYear,  setViewYear]  = useState(Number(today.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(Number(today.slice(5, 7)) - 1)
  const [booked,    setBooked]    = useState<string[]>([])

  useEffect(() => {
    if (!doctorId) return
    getBookedSlots(doctorId, viewYear, viewMonth).then(setBooked).catch(() => {})
  }, [doctorId, viewYear, viewMonth])

  const availDays = useMemo(() => {
    const s = new Set<number>()
    schedules.forEach(sc => s.add(Number(sc.day_of_week)))
    return s
  }, [schedules])

  const slots = useMemo(() => {
    if (!selectedDate) return []
    const dbDay = toDBDay(new Date(selectedDate + 'T12:00:00').getDay())
    const all   = new Set<string>()
    schedules.filter(sc => sc.day_of_week === dbDay).forEach(sc => genSlots(sc.start_time, sc.end_time, duration).forEach(s => all.add(s)))
    return Array.from(all).sort()
  }, [selectedDate, schedules, duration])

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth])

  function prevMonth() { viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1) }
  function nextMonth() { viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y+1)) : setViewMonth(m => m+1) }

  const todayYear  = Number(today.slice(0,4))
  const todayMonth = Number(today.slice(5,7)) - 1
  const isPrevDis  = viewYear === todayYear && viewMonth === todayMonth

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Calendar */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={prevMonth} disabled={isPrevDis}
            style={{ background: 'none', border: 'none', cursor: isPrevDis ? 'not-allowed' : 'pointer', opacity: isPrevDis ? 0.3 : 1, padding: 4 }}>
            <ChevronLeft style={{ width: 16, height: 16, color: B.muted }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: B.fg }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ChevronRight style={{ width: 16, height: 16, color: B.muted }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {DAY_LABELS.map(l => <div key={l} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: B.muted, padding: '4px 0' }}>{l}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {grid.map((d, i) => {
            if (!d) return <div key={i} />
            const isToday    = d === today
            const isSelected = d === selectedDate
            const isPast     = d < today
            const dbDay      = toDBDay(new Date(d + 'T12:00:00').getDay())
            const avail      = availDays.has(dbDay)
            const disabled   = isPast || !avail
            return (
              <button key={d} disabled={disabled} onClick={() => onSelect(d, '')}
                style={{
                  aspectRatio: '1', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none',
                  background:  isSelected ? B.primary : isToday && avail ? B.bg : 'transparent',
                  color:       isSelected ? '#fff' : disabled ? B.border : B.fg,
                  outline:     isToday && avail && !isSelected ? `2px solid ${B.primary}` : 'none',
                  cursor:      disabled ? 'not-allowed' : 'pointer',
                }}>
                {Number(d.slice(8))}
              </button>
            )
          })}
        </div>
      </div>

      {/* Slots — single column */}
      {selectedDate && (
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: B.muted, margin: '0 0 8px' }}>
            {new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' }).format(new Date(selectedDate + 'T12:00:00'))}
          </p>
          {slots.length === 0 ? (
            <p style={{ fontSize: 13, color: B.muted }}>Sin horarios disponibles.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {slots.map(t => {
                const isBooked = booked.some(b => b.startsWith(`${selectedDate}T${t}:`))
                const isSel    = t === selectedTime
                return (
                  <button key={t} disabled={isBooked} onClick={() => onSelect(selectedDate, t)}
                    style={{
                      padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 500, border: `1px solid ${B.border}`,
                      background: isSel ? B.primary : isBooked ? B.sec : B.sec,
                      color:      isSel ? '#fff'    : isBooked ? B.border : B.fg,
                      textDecoration: isBooked ? 'line-through' : 'none',
                      cursor: isBooked ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}>
                    {t}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  const date = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(iso))
  const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso))
  return { date, time }
}

// ── Main component ────────────────────────────────────────────────────────────

export function ManageAppointmentClient({ appointment: apt, token, schedules }: Props) {
  const { date, time } = fmtDateTime(apt.scheduled_at)
  const doctor      = apt.doctor
  const orgName     = apt.organization?.name ?? ''
  const doctorName  = doctor?.metadata ? String((doctor.metadata as any).name ?? 'Médico') : 'Médico'
  const modality    = apt.notes?.toLowerCase().includes('virtual') ? 'Virtual' : 'Presencial'
  const duration    = doctor?.metadata ? Number((doctor.metadata as any).default_duration || (doctor.metadata as any).duration || 30) : 30

  const [view,    setView]    = useState<'main' | 'reschedule' | 'cancel' | 'done'>('main')
  const [doneMsg, setDoneMsg] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const doReschedule = async () => {
    if (!newDate || !newTime) { setError('Selecciona fecha y hora'); return }
    setLoading(true); setError(null)
    const res  = await fetch('/api/appointment/manage', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'reschedule', new_date: newDate, new_time: newTime }),
    })
    const data = await res.json()
    setLoading(false)
    if (!data.success) { setError(data.error); return }
    setDoneMsg('¡Tu cita ha sido reagendada correctamente!')
    setView('done')
  }

  const doCancel = async () => {
    if (reason.trim().length < 10) { setError('Por favor escribe al menos 10 caracteres'); return }
    setLoading(true); setError(null)
    const res  = await fetch('/api/appointment/manage', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'cancel', cancel_reason: reason }),
    })
    const data = await res.json()
    setLoading(false)
    if (!data.success) { setError(data.error); return }
    setDoneMsg('Tu cita ha sido cancelada. Recibirás un email de confirmación.')
    setView('done')
  }

  return (
    <div style={{ minHeight: '100vh', background: B.bg, padding: '32px 16px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5A9DB5', margin: '0 0 4px' }}>MEDSCALE AI</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: B.fg, margin: 0 }}>{orgName}</h1>
          <p style={{ fontSize: 14, color: B.muted, marginTop: 4 }}>Gestión de cita</p>
        </div>

        {/* Done */}
        {view === 'done' && (
          <div style={{ background: B.card, borderRadius: 20, border: `1px solid ${B.border}`, padding: '40px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>✅</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: B.fg, margin: '0 0 8px' }}>¡Listo!</h2>
            <p style={{ color: B.muted, fontSize: 15 }}>{doneMsg}</p>
          </div>
        )}

        {/* Details card */}
        {view !== 'done' && (
          <div style={{ background: B.card, borderRadius: 20, border: `1px solid ${B.border}`, padding: '24px 28px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.muted, margin: '0 0 16px' }}>Detalles de tu cita</p>
            {[
              { label: 'Médico',    value: doctorName },
              { label: 'Fecha',     value: date },
              { label: 'Hora',      value: time },
              { label: 'Modalidad', value: modality },
              ...(apt.location?.name ? [{ label: 'Sede', value: apt.location.address ? `${apt.location.name} — ${apt.location.address}` : apt.location.name }] : []),
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, marginBottom: i < arr.length-1 ? 10 : 0, borderBottom: i < arr.length-1 ? `1px solid ${B.border}` : 'none' }}>
                <span style={{ color: B.muted, fontSize: 14 }}>{label}</span>
                <span style={{ color: B.fg, fontSize: 14, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Main actions */}
        {view === 'main' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => { setView('reschedule'); setError(null); setNewDate(''); setNewTime('') }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', borderRadius: 14, background: B.primary, color: '#fff', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer' }}>
              <CalendarDays style={{ width: 18, height: 18 }} /> Reagendar cita
            </button>
            <button onClick={() => { setView('cancel'); setError(null) }}
              style={{ width: '100%', padding: '14px', borderRadius: 14, background: '#fff', color: B.danger, fontWeight: 600, fontSize: 15, border: `1.5px solid ${B.danger}`, cursor: 'pointer' }}>
              Cancelar cita
            </button>
          </div>
        )}

        {/* Reschedule */}
        {view === 'reschedule' && (
          <div style={{ background: B.card, borderRadius: 20, border: `1px solid ${B.border}`, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setView('main')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.muted, padding: 0 }}>
                <ArrowLeft style={{ width: 18, height: 18 }} />
              </button>
              <p style={{ fontWeight: 700, color: B.fg, fontSize: 15, margin: 0 }}>Elige nueva fecha y hora</p>
            </div>

            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <MiniCal
                doctorId={doctor?.id ?? ''}
                schedules={schedules}
                duration={duration}
                selectedDate={newDate}
                selectedTime={newTime}
                onSelect={(d, t) => { setNewDate(d); setNewTime(t) }}
              />
            </div>

            {error && <p style={{ color: B.danger, fontSize: 13, margin: 0 }}>{error}</p>}

            <button onClick={doReschedule} disabled={loading || !newDate || !newTime}
              style={{ padding: '13px', borderRadius: 12, background: !loading && newDate && newTime ? B.primary : '#aaa', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: !loading && newDate && newTime ? 'pointer' : 'not-allowed' }}>
              {loading ? 'Guardando...' : 'Confirmar reagendamiento'}
            </button>
          </div>
        )}

        {/* Cancel */}
        {view === 'cancel' && (
          <div style={{ background: B.card, borderRadius: 20, border: `1px solid ${B.border}`, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setView('main')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.muted, padding: 0 }}>
                <ArrowLeft style={{ width: 18, height: 18 }} />
              </button>
              <p style={{ fontWeight: 700, color: B.fg, fontSize: 15, margin: 0 }}>Cancelar cita</p>
            </div>
            <p style={{ color: B.muted, fontSize: 14, margin: 0 }}>¿Por qué deseas cancelar? (requerido)</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
              placeholder="Ej: Debo viajar ese día, no puedo asistir..."
              style={{ width: '100%', borderRadius: 12, border: `1px solid ${B.border}`, padding: '10px 12px', fontSize: 14, color: B.fg, resize: 'vertical', boxSizing: 'border-box', background: B.sec }} />
            {error && <p style={{ color: B.danger, fontSize: 13, margin: 0 }}>{error}</p>}
            <button onClick={doCancel} disabled={loading || reason.trim().length < 10}
              style={{ padding: '13px', borderRadius: 12, background: !loading && reason.trim().length >= 10 ? B.danger : '#aaa', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: !loading && reason.trim().length >= 10 ? 'pointer' : 'not-allowed' }}>
              {loading ? 'Cancelando...' : 'Confirmar cancelación'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
