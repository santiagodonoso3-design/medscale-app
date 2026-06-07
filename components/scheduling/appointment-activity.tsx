'use client'

import { useState } from 'react'
import { ChevronDown, CalendarPlus, CalendarClock, CalendarX2, XCircle, CheckCircle, Mail, MailX, MessageSquare, Clock } from 'lucide-react'
import { getAppointmentLogs, type AppointmentLogEntry } from '@/app/(app)/scheduling/actions'

// Mapeo event_type -> texto legible en español. Vive en el front: cambiar textos NO requiere migración.
const EVENT_CONFIG: Record<string, { label: string; Icon: typeof Mail; tone: 'normal' | 'error' }> = {
  created:            { label: 'Cita agendada',                       Icon: CalendarPlus,  tone: 'normal' },
  rescheduled:        { label: 'Cita reagendada',                     Icon: CalendarClock, tone: 'normal' },
  cancelled:          { label: 'Cita cancelada',                      Icon: XCircle,       tone: 'normal' },
  completed:          { label: 'Marcada como completada',             Icon: CheckCircle,   tone: 'normal' },
  no_show:            { label: 'Marcada como no asistió',             Icon: XCircle,       tone: 'normal' },
  feedback:           { label: 'Motivo de cancelación recibido',      Icon: MessageSquare, tone: 'normal' },
  email_patient_sent: { label: 'Correo de confirmación al paciente',  Icon: Mail,          tone: 'normal' },
  email_clinic_sent:  { label: 'Notificación enviada a la clínica',   Icon: Mail,          tone: 'normal' },
  email_doctor_sent:  { label: 'Notificación enviada al médico',      Icon: Mail,          tone: 'normal' },
  email_failed:           { label: 'Falló el envío de un correo',         Icon: MailX,         tone: 'error' },
  calendar_event_created: { label: 'Evento agregado al calendario',        Icon: CalendarPlus,  tone: 'normal' },
  calendar_failed:        { label: 'Falló la creación del evento',         Icon: CalendarX2,    tone: 'error' },
}

function actorLabel(actorType: string | null, actorName: string | null): string {
  if (actorType === 'staff') return actorName ? `por ${actorName}` : 'por el equipo'
  if (actorType === 'patient') return 'por el paciente'
  if (actorType === 'system') return 'automático'
  return ''
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function fmtDayHeader(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
}

export function AppointmentActivity({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [logs, setLogs] = useState<AppointmentLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    // Lazy load: solo trae los logs la primera vez que se expande
    if (next && !loaded) {
      setLoading(true)
      const res = await getAppointmentLogs(appointmentId)
      if (res.error) setError(res.error)
      else setLogs(res.logs ?? [])
      setLoaded(true)
      setLoading(false)
    }
  }

  // Agrupar por día preservando orden cronológico
  const groups: { day: string; header: string; entries: AppointmentLogEntry[] }[] = []
  for (const log of logs) {
    const k = dayKey(log.createdAt)
    let g = groups.find(x => x.day === k)
    if (!g) { g = { day: k, header: fmtDayHeader(log.createdAt), entries: [] }; groups.push(g) }
    g.entries.push(log)
  }

  return (
    <div className="border-t border-slate-100 pt-4">
      <button
        onClick={toggle}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
      >
        <Clock className="h-3.5 w-3.5" />
        Ver actividad
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4">
          {loading && <p className="text-xs text-slate-400">Cargando actividad...</p>}
          {error && <p className="text-xs text-rose-500">No se pudo cargar la actividad</p>}
          {!loading && !error && logs.length === 0 && (
            <p className="text-xs italic text-slate-300">Sin actividad registrada</p>
          )}
          {!loading && !error && groups.map(group => (
            <div key={group.day} className="mb-5 last:mb-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{group.header}</p>
              <div className="space-y-3">
                {group.entries.map(entry => {
                  const cfg = EVENT_CONFIG[entry.eventType] ?? { label: entry.eventType, Icon: Clock, tone: 'normal' as const }
                  const isError = cfg.tone === 'error'
                  const actor = actorLabel(entry.actorType, entry.actorName)
                  return (
                    <div key={entry.id} className="flex gap-3">
                      <div className="text-xs text-slate-400 w-16 shrink-0 pt-0.5 tabular-nums">{fmtTime(entry.createdAt)}</div>
                      <div className={`mt-0.5 shrink-0 ${isError ? 'text-rose-500' : 'text-slate-400'}`}>
                        <cfg.Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm ${isError ? 'text-rose-600 font-medium' : 'text-slate-700'}`}>
                          {cfg.label} {actor && <span className="text-slate-400 font-normal">{actor}</span>}
                        </p>
                        {entry.note && <p className="text-xs text-slate-500 mt-0.5 break-words">{entry.note}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
