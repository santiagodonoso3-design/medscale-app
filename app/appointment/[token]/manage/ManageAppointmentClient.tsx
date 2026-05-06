'use client'

import { useState } from 'react'
import { CalendarPicker } from '@/components/shared/CalendarPicker'
import type { ScheduleOption, DoctorOption } from '@/components/shared/CalendarPicker'
import { ArrowLeft, CalendarDays, X } from 'lucide-react'

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

interface Props { appointment: Apt; token: string }

function fmtDateTime(iso: string) {
  const date = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(iso))
  const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso))
  return { date, time }
}

export function ManageAppointmentClient({ appointment: apt, token }: Props) {
  const { date, time } = fmtDateTime(apt.scheduled_at)
  const orgName    = apt.organization?.name ?? ''
  const doctorName = apt.doctor?.metadata ? String((apt.doctor.metadata as any).name ?? 'Médico') : 'Médico'
  const modality   = apt.notes?.toLowerCase().includes('virtual') ? 'Virtual' : 'Presencial'

  const [view, setView]         = useState<'main' | 'reschedule' | 'cancel' | 'done'>('main')
  const [doneMsg, setDoneMsg]   = useState('')
  const [newDate, setNewDate]   = useState('')
  const [newTime, setNewTime]   = useState('')
  const [reason, setReason]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const doReschedule = async () => {
    if (!newDate || !newTime) { setError('Selecciona fecha y hora'); return }
    setLoading(true); setError(null)
    const res = await fetch('/api/appointment/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/appointment/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5A9DB5', margin: '0 0 4px' }}>MEDSCALE AI</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: B.fg, margin: 0 }}>{orgName}</h1>
          <p style={{ fontSize: 14, color: B.muted, marginTop: 4 }}>Gestión de cita</p>
        </div>

        {/* Done screen */}
        {view === 'done' && (
          <div style={{ background: B.card, borderRadius: 20, border: `1px solid ${B.border}`, padding: '40px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>✅</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: B.fg, margin: '0 0 8px' }}>¡Listo!</h2>
            <p style={{ color: B.muted, fontSize: 15 }}>{doneMsg}</p>
          </div>
        )}

        {/* Appointment card */}
        {view !== 'done' && (
          <div style={{ background: B.card, borderRadius: 20, border: `1px solid ${B.border}`, padding: '24px 28px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.muted, margin: '0 0 16px' }}>Detalles de tu cita</p>
            {[
              { label: 'Médico',    value: doctorName },
              { label: 'Fecha',     value: date },
              { label: 'Hora',      value: time },
              { label: 'Modalidad', value: modality },
              ...(apt.location?.name ? [{ label: 'Sede', value: apt.location.address ? `${apt.location.name} — ${apt.location.address}` : apt.location.name }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${B.border}` }}>
                <span style={{ color: B.muted, fontSize: 14 }}>{label}</span>
                <span style={{ color: B.fg, fontSize: 14, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Main actions */}
        {view === 'main' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => { setView('reschedule'); setError(null) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', borderRadius: 14, background: B.primary, color: '#fff', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer' }}>
              <CalendarDays style={{ width: 18, height: 18 }} />
              Reagendar cita
            </button>
            <button onClick={() => { setView('cancel'); setError(null) }}
              style={{ width: '100%', padding: '14px', borderRadius: 14, background: '#fff', color: B.danger, fontWeight: 600, fontSize: 15, border: `1.5px solid ${B.danger}`, cursor: 'pointer' }}>
              Cancelar cita
            </button>
          </div>
        )}

        {/* Reschedule */}
        {view === 'reschedule' && (
          <div style={{ background: B.card, borderRadius: 20, border: `1px solid ${B.border}`, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setView('main')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.muted, padding: 0 }}>
                <ArrowLeft style={{ width: 18, height: 18 }} />
              </button>
              <p style={{ fontWeight: 700, color: B.fg, fontSize: 15, margin: 0 }}>Elige nueva fecha y hora</p>
            </div>
            <div style={{ fontSize: '0.9em' }}>
              <CalendarPicker
                orgName={orgName}
                selectedDoctor={apt.doctor ? { id: apt.doctor.id, specialty: null, is_active: true, metadata: apt.doctor.metadata as any } as DoctorOption : null}
                effectiveSchedules={[] as ScheduleOption[]}
                selectedDate={newDate}
                selectedTime={newTime}
                onSelect={(d, t) => { setNewDate(d); setNewTime(t) }}
                doctorId={apt.doctor?.id ?? ''}
                minNoticeHours={0}
                texts={{ org: 'Org', doctor: 'Médico', autoAssign: 'Sin asignar', selected: 'Seleccionado', loading: 'Cargando...', noSlots: 'Sin horarios. Escribe fecha y hora manualmente abajo.', docFallback: 'Médico' }}
              />
            </div>
            {error && <p style={{ color: B.danger, fontSize: 13 }}>{error}</p>}
            <button onClick={doReschedule} disabled={loading || !newDate || !newTime}
              style={{ padding: '13px', borderRadius: 12, background: newDate && newTime ? B.primary : '#ccc', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: newDate && newTime ? 'pointer' : 'not-allowed' }}>
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
            <p style={{ color: B.muted, fontSize: 14, margin: 0 }}>¿Por qué deseas cancelar tu cita? (requerido)</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
              placeholder="Ej: Debo viajar ese día, no puedo asistir..."
              style={{ width: '100%', borderRadius: 12, border: `1px solid ${B.border}`, padding: '10px 12px', fontSize: 14, color: B.fg, resize: 'vertical', boxSizing: 'border-box', background: B.sec }} />
            {error && <p style={{ color: B.danger, fontSize: 13, margin: 0 }}>{error}</p>}
            <button onClick={doCancel} disabled={loading || reason.trim().length < 10}
              style={{ padding: '13px', borderRadius: 12, background: reason.trim().length >= 10 ? B.danger : '#ccc', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: reason.trim().length >= 10 ? 'pointer' : 'not-allowed' }}>
              {loading ? 'Cancelando...' : 'Confirmar cancelación'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
