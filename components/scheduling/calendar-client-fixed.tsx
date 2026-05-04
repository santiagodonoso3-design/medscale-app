'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, X, Loader2, CalendarDays, List, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  cancelAppointment,
  updateAppointmentNotes,
  rescheduleAppointment,
  logCancellation,
} from '@/app/(app)/scheduling/actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type AppointmentRecord = {
  id: string
  scheduled_at: string
  ends_at: string | null
  status: string
  notes: string | null
  doctor_id: string
  lead_id: string | null
  location_id: string | null
  metadata: Record<string, unknown> | null
  lead?: { contact_name: string | null; contact_phone: string | null; contact_email: string | null } | null
  doctor?: { metadata: Record<string, unknown> | null } | null
  location?: { name: string } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No show',
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-red-100 text-red-700',
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ── Utilities ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rawDow = firstDay.getDay()
  const leadingEmpties = rawDow === 0 ? 6 : rawDow - 1
  const grid: (string | null)[] = Array(leadingEmpties).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

function formatDateHeader(dateStr: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(new Date(dateStr + 'T12:00:00'))
}

function modalityFromNotes(notes: string | null): string {
  if (!notes) return '—'
  if (notes.toLowerCase().includes('virtual')) return 'Virtual'
  if (notes.toLowerCase().includes('presencial')) return 'Presencial'
  return '—'
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isoToLocalTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function statusDotColor(status: string): string {
  if (status === 'completed') return 'bg-emerald-500'
  if (status === 'cancelled') return 'bg-slate-300'
  if (status === 'confirmed') return 'bg-sky-500'
  if (status === 'no_show') return 'bg-red-400'
  return 'bg-blue-500'
}

function statusChipClass(status: string): string {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800'
  if (status === 'cancelled') return 'bg-slate-100 text-slate-400 line-through'
  if (status === 'confirmed') return 'bg-sky-100 text-sky-800'
  if (status === 'no_show') return 'bg-red-100 text-red-700'
  return 'bg-blue-100 text-blue-800'
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CalendarClientProps {
  userId: string | null
}

export function CalendarClient({ userId }: CalendarClientProps) {
  const today = todayStr()
  const todayYear = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7)) - 1

  // ── Data state
  const [doctors, setDoctors] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── View/filter state
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [filterDoctor, setFilterDoctor] = useState('')
  const [search, setSearch] = useState('')

  // ── Calendar grid state
  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // ── Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    doctor_id: '',
    location_id: '',
    scheduled_at: '',
    patient_name: '',
    patient_phone: '',
    patient_email: '',
    notes: '',
    lead_search: '',
    lead_id: '',
  })
  const [leadResults, setLeadResults] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  // ── Detail modal state
  const [selected, setSelected] = useState<AppointmentRecord | null>(null)
  const [modalNotes, setModalNotes] = useState('')
  const [modalRescheduleDate, setModalRescheduleDate] = useState('')
  const [modalRescheduleTime, setModalRescheduleTime] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const supabase = createClient()

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    const [
      { data: doctorData, error: doctorError },
      { data: locationData, error: locationError },
      { data: aptData, error: aptError },
    ] = await Promise.all([
      supabase.from('doctors').select('id, specialty, is_active, metadata').eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('locations').select('id, name').order('name', { ascending: true }),
      supabase
        .from('appointments')
        .select('id, scheduled_at, ends_at, status, doctor_id, lead_id, location_id, notes, doctor:doctor_id(metadata), lead:lead_id(contact_name,contact_phone,contact_email), location:location_id(name)')
        .order('scheduled_at', { ascending: true }),
    ])
    if (doctorError || locationError || aptError) {
      setError(doctorError?.message || locationError?.message || aptError?.message || 'Error cargando datos')
      setLoading(false)
      return
    }
    setDoctors(doctorData || [])
    setLocations(locationData || [])
    setAppointments((aptData as unknown as AppointmentRecord[]) || [])
    if (!form.doctor_id && doctorData?.length) setForm(prev => ({ ...prev, doctor_id: doctorData[0].id }))
    if (!form.location_id && locationData?.length) setForm(prev => ({ ...prev, location_id: locationData[0].id }))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Filtered appointments ──────────────────────────────────────────────────

  const filteredAppointments = useMemo(() =>
    appointments.filter(apt => {
      const matchesDoctor = !filterDoctor || apt.doctor_id === filterDoctor
      const matchesSearch = !search ||
        apt.lead?.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
        apt.lead?.contact_phone?.includes(search)
      return matchesDoctor && matchesSearch
    }),
    [appointments, filterDoctor, search]
  )

  // ── Calendar grid data ─────────────────────────────────────────────────────

  const monthGrid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const appointmentsByDay = useMemo(() => {
    const map: Record<string, AppointmentRecord[]> = {}
    filteredAppointments.forEach(apt => {
      const day = apt.scheduled_at.slice(0, 10)
      if (!map[day]) map[day] = []
      map[day].push(apt)
    })
    return map
  }, [filteredAppointments])

  const selectedDayApts = useMemo(() =>
    selectedDay ? (appointmentsByDay[selectedDay] ?? []) : [],
    [selectedDay, appointmentsByDay]
  )

  // ── List view data ─────────────────────────────────────────────────────────

  const { grouped, cancelled } = useMemo(() => {
    const nonCancelled = filteredAppointments.filter(a => a.status !== 'cancelled')
    const cancelled = filteredAppointments.filter(a => a.status === 'cancelled')
    const map: Record<string, AppointmentRecord[]> = {}
    nonCancelled.forEach(apt => {
      const day = apt.scheduled_at.slice(0, 10)
      if (!map[day]) map[day] = []
      map[day].push(apt)
    })
    return { grouped: map, cancelled }
  }, [filteredAppointments])

  const sortedDays = useMemo(() => Object.keys(grouped).sort(), [grouped])

  // ── Modal handlers ─────────────────────────────────────────────────────────

  function openModal(apt: AppointmentRecord) {
    setSelected(apt)
    setModalNotes(apt.notes ?? '')
    setModalRescheduleDate(isoToLocalDate(apt.scheduled_at))
    setModalRescheduleTime(isoToLocalTime(apt.scheduled_at))
    setModalError(null)
    setShowCancelConfirm(false)
    setCancelReason('')
  }

  function closeModal() {
    setSelected(null)
    setModalSaving(false)
    setModalError(null)
    setShowCancelConfirm(false)
    setCancelReason('')
  }

  async function handleSaveNotes() {
    if (!selected) return
    setModalSaving(true)
    setModalError(null)
    const result = await updateAppointmentNotes(selected.id, modalNotes)
    if (result.error) { setModalError(result.error) } else {
      await fetchData()
      setSelected(prev => prev ? { ...prev, notes: modalNotes } : null)
    }
    setModalSaving(false)
  }

  async function handleReschedule() {
    if (!selected || !modalRescheduleDate || !modalRescheduleTime) return
    setModalSaving(true)
    setModalError(null)
    const scheduledAt = new Date(`${modalRescheduleDate}T${modalRescheduleTime}`).toISOString()
    const originalDuration = selected.ends_at
      ? new Date(selected.ends_at).getTime() - new Date(selected.scheduled_at).getTime()
      : 30 * 60000
    const endsAt = new Date(new Date(`${modalRescheduleDate}T${modalRescheduleTime}`).getTime() + originalDuration).toISOString()
    const result = await rescheduleAppointment(selected.id, scheduledAt, endsAt)
    if (result.error) { setModalError(result.error) } else {
      await fetchData()
      setSelected(prev => prev ? { ...prev, scheduled_at: scheduledAt, ends_at: endsAt } : null)
    }
    setModalSaving(false)
  }

  async function handleCancel() {
    if (!selected || !cancelReason.trim()) return
    setModalSaving(true)
    setModalError(null)
    // Log cancellation first, then update status
    await logCancellation(selected.id, cancelReason.trim(), userId)
    const result = await cancelAppointment(selected.id)
    if (result.error) { setModalError(result.error) } else {
      await fetchData()
      closeModal()
    }
    setModalSaving(false)
  }

  // ── Create handlers ────────────────────────────────────────────────────────

  const handleSearchLeads = async () => {
    if (!form.lead_search) { setLeadResults([]); return }
    const { data } = await supabase.from('leads').select('id, contact_name, contact_phone')
      .ilike('contact_name', `%${form.lead_search}%`).order('created_at', { ascending: false }).limit(10)
    setLeadResults(data || [])
  }

  const handleSelectLead = (lead: any) => {
    setForm(prev => ({ ...prev, lead_id: lead.id, patient_name: lead.contact_name || '', patient_phone: lead.contact_phone || '', lead_search: '' }))
    setLeadResults([])
  }

  const handleCreateAppointment = async () => {
    if (!form.doctor_id || !form.location_id || !form.scheduled_at || !form.patient_name) {
      setError('Completa médico, sede, fecha y nombre del paciente.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let leadId = form.lead_id
      if (!leadId) {
        const { data: leadData, error: leadErr } = await supabase.from('leads').insert({
          contact_name: form.patient_name,
          contact_phone: form.patient_phone || null,
          contact_email: form.patient_email || null,
          source: 'manual', status: 'new', notes: form.notes || null,
        }).select('id').single()
        if (leadErr || !leadData) throw leadErr || new Error('Error creando lead')
        leadId = leadData.id
      }
      const start = new Date(form.scheduled_at)
      const end = new Date(start.getTime() + 30 * 60000)
      const { error: aptErr } = await supabase.from('appointments').insert({
        doctor_id: form.doctor_id, location_id: form.location_id, lead_id: leadId,
        scheduled_at: start.toISOString(), ends_at: end.toISOString(), status: 'scheduled', notes: form.notes || null,
      })
      if (aptErr) throw aptErr
      setForm(prev => ({ ...prev, lead_search: '', lead_id: '', patient_name: '', patient_phone: '', patient_email: '', notes: '' }))
      setLeadResults([])
      setShowCreate(false)
      await fetchData()
    } catch { setError('No se pudo crear la cita.') }
    finally { setSaving(false) }
  }

  // ── Appointment card (shared between calendar and list view) ───────────────

  function AptCard({ apt, compact = false }: { apt: AppointmentRecord; compact?: boolean }) {
    const d = new Date(apt.scheduled_at)
    const isCancelled = apt.status === 'cancelled'
    return (
      <button
        onClick={() => openModal(apt)}
        className={[
          'w-full text-left rounded-2xl border px-3 py-2.5 transition hover:shadow-sm',
          isCancelled
            ? 'border-slate-100 bg-slate-50 opacity-60'
            : apt.status === 'completed'
            ? 'border-emerald-100 bg-emerald-50/50'
            : 'border-blue-100 bg-blue-50/50',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
              {apt.lead?.contact_name || 'Sin nombre'}
            </p>
            {!compact && (
              <p className="text-xs text-slate-500 mt-0.5">
                {apt.doctor?.metadata?.name as string || 'Médico'}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-slate-700">
              {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {!compact && (
              <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {STATUS_LABELS[apt.status] ?? apt.status}
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  // ── Calendar grid ──────────────────────────────────────────────────────────

  function renderCalendarView() {
    const isPrevDisabled = viewYear === todayYear && viewMonth === todayMonth
    return (
      <div className="space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
              else setViewMonth(m => m - 1)
            }}
            disabled={isPrevDisabled}
            className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-900">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={() => {
              if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
              else setViewMonth(m => m + 1)
            }}
            className="p-2 rounded-xl hover:bg-slate-100 transition"
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAY_LABELS.map(label => (
            <div key={label} className="text-center text-xs font-medium text-slate-400 py-2">
              {label}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-7 border-l border-t border-slate-100">
          {monthGrid.map((dateStr, i) => {
            if (!dateStr) {
              return <div key={i} className="border-r border-b border-slate-100 min-h-[70px] sm:min-h-[96px] bg-slate-50/50" />
            }

            const isToday = dateStr === today
            const dayApts = appointmentsByDay[dateStr] ?? []
            const nonCancelledApts = dayApts.filter(a => a.status !== 'cancelled')
            const isSelected = dateStr === selectedDay

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                className={[
                  'border-r border-b border-slate-100 min-h-[70px] sm:min-h-[96px] p-1.5 cursor-pointer transition-colors',
                  isSelected ? 'bg-blue-50' : 'hover:bg-slate-50',
                ].join(' ')}
              >
                {/* Day number */}
                <span className={[
                  'inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold',
                  isToday ? 'bg-blue-600 text-white' : isSelected ? 'text-blue-700' : 'text-slate-700',
                ].join(' ')}>
                  {Number(dateStr.slice(8))}
                </span>

                {/* Mobile: dots */}
                {nonCancelledApts.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {nonCancelledApts.slice(0, 3).map(apt => (
                      <span key={apt.id} className={`w-1.5 h-1.5 rounded-full ${statusDotColor(apt.status)}`} />
                    ))}
                    {nonCancelledApts.length > 3 && (
                      <span className="text-[9px] text-slate-400 leading-none self-center">
                        +{nonCancelledApts.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Desktop: text chips */}
                {nonCancelledApts.length > 0 && (
                  <div className="mt-1 hidden sm:flex flex-col gap-0.5">
                    {nonCancelledApts.slice(0, 2).map(apt => (
                      <span
                        key={apt.id}
                        className={`block truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium ${statusChipClass(apt.status)}`}
                      >
                        {isoToLocalTime(apt.scheduled_at)} {apt.lead?.contact_name?.split(' ')[0] ?? '—'}
                      </span>
                    ))}
                    {nonCancelledApts.length > 2 && (
                      <span className="text-[9px] text-slate-400 pl-1">
                        +{nonCancelledApts.length - 2} más
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Expanded day */}
        {selectedDay && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 capitalize">
                {formatDateHeader(selectedDay)}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="p-1 rounded-lg hover:bg-slate-100 transition">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            {selectedDayApts.length === 0 ? (
              <p className="text-sm text-slate-400">No hay citas para este día.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayApts.map(apt => <AptCard key={apt.id} apt={apt} />)}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  function renderListView() {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando citas...</span>
        </div>
      )
    }

    if (sortedDays.length === 0 && cancelled.length === 0) {
      return <p className="py-12 text-center text-sm text-slate-400">No hay citas para los filtros seleccionados.</p>
    }

    return (
      <div className="space-y-6">
        {/* Upcoming / completed grouped by date */}
        {sortedDays.length === 0 && (
          <p className="text-sm text-slate-400">No hay citas programadas o completadas.</p>
        )}
        {sortedDays.map(day => (
          <div key={day}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 capitalize">
              {formatDateHeader(day)}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Paciente</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Médico</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Hora</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Modalidad</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {grouped[day].map(apt => {
                    const d = new Date(apt.scheduled_at)
                    return (
                      <tr
                        key={apt.id}
                        onClick={() => openModal(apt)}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {apt.lead?.contact_name || 'Sin nombre'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {apt.doctor?.metadata?.name as string || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{modalityFromNotes(apt.notes)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_LABELS[apt.status] ?? apt.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Cancelled section */}
        {cancelled.length > 0 && (
          <div className="opacity-60">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Citas canceladas ({cancelled.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {cancelled.map(apt => {
                    const d = new Date(apt.scheduled_at)
                    return (
                      <tr
                        key={apt.id}
                        onClick={() => openModal(apt)}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-3 py-2 line-through text-slate-400">
                          {apt.lead?.contact_name || 'Sin nombre'}
                        </td>
                        <td className="px-3 py-2 text-slate-400">
                          {apt.doctor?.metadata?.name as string || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-400">
                          {d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2 text-slate-400">{modalityFromNotes(apt.notes)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Cancelada</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-4">
        {/* Controls: filters + toggle + new appointment */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: filters */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-1 min-w-0">
              <select
                value={filterDoctor}
                onChange={e => setFilterDoctor(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los médicos</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.metadata?.name || 'Médico'}</option>
                ))}
              </select>
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar paciente..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Right: view toggle + new button */}
            <div className="flex items-center gap-2 shrink-0">
              {/* View toggle */}
              <div className="flex items-center rounded-xl border border-slate-200 p-0.5">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                    viewMode === 'calendar' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Calendario
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                    viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <List className="h-3.5 w-3.5" />
                  Lista
                </button>
              </div>

              {/* New appointment button */}
              <button
                onClick={() => setShowCreate(prev => !prev)}
                className={[
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition',
                  showCreate
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700',
                ].join(' ')}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {showCreate ? 'Cerrar' : 'Nueva cita'}
              </button>
            </div>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Nueva cita manual</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Médico</label>
                <select value={form.doctor_id} onChange={e => setForm(p => ({ ...p, doctor_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <option value="">Selecciona un médico</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.metadata?.name || 'Médico'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Sede</label>
                <select value={form.location_id} onChange={e => setForm(p => ({ ...p, location_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <option value="">Selecciona una sede</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Fecha y hora</label>
                <input type="datetime-local" value={form.scheduled_at}
                  onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Nombre del paciente</label>
                <input value={form.patient_name} onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Teléfono</label>
                <input value={form.patient_phone} onChange={e => setForm(p => ({ ...p, patient_phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input type="email" value={form.patient_email} onChange={e => setForm(p => ({ ...p, patient_email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Buscar lead existente</label>
                <div className="mt-1 flex gap-2">
                  <input value={form.lead_search} onChange={e => setForm(p => ({ ...p, lead_search: e.target.value }))}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Nombre del paciente" />
                  <button onClick={handleSearchLeads}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition">
                    <Search className="h-3.5 w-3.5" /> Buscar
                  </button>
                </div>
                {leadResults.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {leadResults.map(lead => (
                      <button key={lead.id} onClick={() => handleSelectLead(lead)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100">
                        {lead.contact_name || 'Sin nombre'} · {lead.contact_phone || 'Sin teléfono'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
              <div className="sm:col-span-2 flex justify-end">
                <button onClick={handleCreateAppointment} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Crear cita
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main view */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {loading && viewMode === 'calendar' ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando citas...</span>
            </div>
          ) : viewMode === 'calendar' ? (
            renderCalendarView()
          ) : (
            renderListView()
          )}
        </div>
      </div>

      {/* ── Detail modal ──────────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Detalle de cita</h2>
                <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[selected.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
              </div>
              <button onClick={closeModal} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Paciente</p>
                  <p className="font-medium text-slate-900">{selected.lead?.contact_name || 'Sin nombre'}</p>
                  {selected.lead?.contact_phone && <p className="text-slate-500 mt-0.5">{selected.lead.contact_phone}</p>}
                  {selected.lead?.contact_email && <p className="text-slate-500 text-xs mt-0.5">{selected.lead.contact_email}</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Médico</p>
                  <p className="font-medium text-slate-900">{(selected.doctor?.metadata?.name as string) || 'Sin asignar'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Fecha y hora</p>
                  <p className="font-medium text-slate-900">
                    {new Date(selected.scheduled_at).toLocaleString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Sede · Modalidad</p>
                  <p className="text-slate-700">{selected.location?.name || '—'} · {modalityFromNotes(selected.notes)}</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
                <textarea value={modalNotes} onChange={e => setModalNotes(e.target.value)} rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Sin notas..." />
                <button onClick={handleSaveNotes} disabled={modalSaving}
                  className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50">
                  {modalSaving ? 'Guardando...' : 'Guardar notas'}
                </button>
              </div>

              {/* Reschedule */}
              {!['cancelled', 'completed'].includes(selected.status) && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reagendar</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input type="date" value={modalRescheduleDate} onChange={e => setModalRescheduleDate(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="time" value={modalRescheduleTime} onChange={e => setModalRescheduleTime(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button onClick={handleReschedule} disabled={modalSaving || !modalRescheduleDate || !modalRescheduleTime}
                    className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50">
                    {modalSaving ? 'Guardando...' : 'Confirmar reagendamiento'}
                  </button>
                </div>
              )}

              {modalError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p>
              )}

              {/* Cancel — with required reason */}
              {!['cancelled', 'completed'].includes(selected.status) && (
                <div className="border-t border-slate-100 pt-4">
                  {!showCancelConfirm ? (
                    <button onClick={() => setShowCancelConfirm(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 transition">
                      Cancelar esta cita
                    </button>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-slate-700">Motivo de cancelación <span className="text-red-500">*</span></p>
                      <textarea
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        rows={2}
                        placeholder="Escribe el motivo de cancelación..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <p className="text-xs text-slate-400">Requerido. Se guardará en el historial de la cita.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancel}
                          disabled={modalSaving || !cancelReason.trim()}
                          className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {modalSaving ? 'Cancelando...' : 'Confirmar cancelación'}
                        </button>
                        <button onClick={() => { setShowCancelConfirm(false); setCancelReason('') }}
                          className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                          Volver
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
