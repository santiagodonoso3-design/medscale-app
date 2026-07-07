'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, X, Loader2, CalendarDays, List, ChevronLeft, ChevronRight, ChevronDown, CheckCircle, XCircle, Calendar } from 'lucide-react'
import { CalendarPicker, type ScheduleOption } from '@/components/shared/CalendarPicker'
import { AppointmentActivity } from '@/components/scheduling/appointment-activity'
import { bogotaDayStr, todayBogotaStr } from '@/lib/date'
import {
  cancelAppointment,
  updateAppointmentNotes,
  rescheduleAppointment,
  logCancellation,
  updateAppointmentStatus,
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
  appointment_type_id: string | null
  metadata: Record<string, unknown> | null
  lead?: {
    contact_name: string | null
    contact_last_name: string | null
    contact_phone: string | null
    contact_email: string | null
    contact_cedula?: string | null
    metadata?: Record<string, unknown> | null
  } | null
  doctor?: { metadata: Record<string, unknown> | null } | null
  location?: { name: string } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-red-100 text-red-700',
}

// All reachable statuses from any status — every state can go to every other state
const ALL_STATUSES = [
  { value: 'scheduled',  label: 'Programada'  },
  { value: 'completed',  label: 'Completada'  },
  { value: 'no_show',    label: 'No asistió'  },
  { value: 'cancelled',  label: 'Cancelada'   },
]
const STATUS_TRANSITIONS = Object.fromEntries(
  ALL_STATUSES.map(s => [s.value, ALL_STATUSES.filter(t => t.value !== s.value)])
)

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

function getDateRange(range: 'hoy' | 'semana' | 'mes' | 'todos'): { from: string; to: string } | null {
  const today = todayStr()
  if (range === 'hoy') return { from: today, to: today }
  if (range === 'semana') {
    const d = new Date(today + 'T12:00:00')
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
    const mon = new Date(d); mon.setDate(d.getDate() - dow)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
    return { from: fmt(mon), to: fmt(sun) }
  }
  if (range === 'mes') {
    const y = today.slice(0, 4), m = today.slice(5, 7)
    const last = new Date(Number(y), Number(m), 0).getDate()
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, '0')}` }
  }
  return null
}

function isoToLocalDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso))
}

function isoToLocalTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
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
  doctorId?: string | null
  orgId: string
  readOnly?: boolean
}

export function CalendarClient({ userId, doctorId, orgId, readOnly = false }: CalendarClientProps) {
  const today = todayStr()
  const todayYear = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7)) - 1

  // ── Data state
  const [doctors, setDoctors] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [schedules, setSchedules] = useState<ScheduleOption[]>([])
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([])
  const [formFieldsByType, setFormFieldsByType] = useState<Record<string, { field_name: string; field_label: string; field_type: string; sort_order: number }[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── View/filter state
  const [viewMode,      setViewMode]      = useState<'calendar' | 'list'>('list')
  const [timeView,      setTimeView]      = useState<'upcoming' | 'past'>('upcoming')
  const [showCancelled, setShowCancelled] = useState(true)
  const [listRange,     setListRange]     = useState<'hoy' | 'semana' | 'mes' | 'todos'>('todos')
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
    scheduled_date: '',
    scheduled_time: '',
    patient_name: '',
    patient_phone: '',
    patient_email: '',
    notes: '',
    lead_id: '',
    appointment_type_id: '',
    modality: 'presencial' as 'presencial' | 'virtual',
  })
  const [createStep, setCreateStep] = useState<'patient' | 'schedule'>('patient')
  const [patientMode, setPatientMode] = useState<'search' | 'new'>('new')
  const [leadResults, setLeadResults] = useState<any[]>([])
  const [leadSearch, setLeadSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Detail modal state
  const [selected, setSelected] = useState<AppointmentRecord | null>(null)
  const [modalNotes, setModalNotes] = useState('')
  const [modalRescheduleDate, setModalRescheduleDate] = useState('')
  const [modalRescheduleTime, setModalRescheduleTime] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelReason,      setCancelReason]      = useState('')
  const [showReschedule,    setShowReschedule]    = useState(false)

  // ── Inline status popover
  const [statusPopover, setStatusPopover] = useState<{ aptId: string; top: number; bottom: number; left: number; openUpward: boolean } | null>(null)
  const [statusToast,   setStatusToast]   = useState<string | null>(null)

  const supabase = createClient()

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    const [
      { data: doctorData, error: doctorError },
      { data: locationData, error: locationError },
      { data: aptData, error: aptError },
      { data: aptTypeData },
      { data: formFieldsData },
    ] = await Promise.all([
      supabase.from('doctors').select('id, specialty, is_active, metadata').eq('organization_id', orgId).eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('locations').select('id, name').eq('organization_id', orgId).order('name', { ascending: true }),
      (() => {
        let q = supabase
          .from('appointments')
          .select('id, scheduled_at, ends_at, status, doctor_id, lead_id, location_id, notes, appointment_type_id, doctor:doctor_id(metadata), lead:lead_id(contact_name,contact_last_name,contact_phone,contact_email,contact_cedula,metadata), location:location_id(name)')
          .eq('organization_id', orgId)
          .order('scheduled_at', { ascending: true })
        if (doctorId) q = q.eq('doctor_id', doctorId)
        return q
      })(),
      supabase.from('appointment_types').select('id, name, duration_minutes, modality, price_presencial, price_virtual').eq('organization_id', orgId).eq('active', true).order('name', { ascending: true }),
      supabase.from('appointment_form_fields').select('appointment_type_id, field_name, field_label, field_type, sort_order').eq('organization_id', orgId).eq('active', true).order('sort_order', { ascending: true }),
    ])
    if (doctorError || locationError || aptError) {
      setError(doctorError?.message || locationError?.message || aptError?.message || 'Error cargando datos')
      setLoading(false)
      return
    }
    setDoctors(doctorData || [])
    setLocations(locationData || [])
    setAppointments((aptData as unknown as AppointmentRecord[]) || [])
    setAppointmentTypes(aptTypeData || [])
    if (formFieldsData) {
      const grouped: Record<string, { field_name: string; field_label: string; field_type: string; sort_order: number }[]> = {}
      for (const f of formFieldsData as any[]) {
        if (!grouped[f.appointment_type_id]) grouped[f.appointment_type_id] = []
        grouped[f.appointment_type_id].push({ field_name: f.field_name, field_label: f.field_label, field_type: f.field_type ?? 'text', sort_order: f.sort_order })
      }
      setFormFieldsByType(grouped)
    }
    if (doctorData && doctorData.length > 0) {
      const { data: schedData } = await supabase
        .from('schedules')
        .select('id, doctor_id, location_id, day_of_week, start_time, end_time')
        .in('doctor_id', doctorData.map((d: any) => d.id))
      setSchedules((schedData ?? []) as ScheduleOption[])
    }
    if (doctorId) setFilterDoctor(doctorId)
    else if (!form.doctor_id && doctorData?.length) setForm(prev => ({ ...prev, doctor_id: doctorData[0].id }))
    if (!form.location_id && locationData?.length) setForm(prev => ({ ...prev, location_id: locationData[0].id }))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Slot generation ────────────────────────────────────────────────────────

  function getDoctorAvailableDays(doctorId: string): number[] {
    return schedules
      .filter(s => s.doctor_id === doctorId && (s as any).is_recurring !== false)
      .map(s => s.day_of_week)
      .filter((v, i, a) => a.indexOf(v) === i)
  }

  // ── Filtered appointments ──────────────────────────────────────────────────

  const filteredAppointments = useMemo(() =>
    appointments.filter(apt => {
      const matchesDoctor = !filterDoctor || apt.doctor_id === filterDoctor
      const matchesSearch = !search ||
        apt.lead?.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
        apt.lead?.contact_last_name?.toLowerCase().includes(search.toLowerCase()) ||
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
      const day = bogotaDayStr(apt.scheduled_at)
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

  const todayForFilter = todayBogotaStr()

  const upcomingData = useMemo(() => {
    const source = filteredAppointments.filter(a => {
      const day = bogotaDayStr(a.scheduled_at)
      return day >= todayForFilter && a.status !== 'cancelled'
    })
    const grouped: Record<string, AppointmentRecord[]> = {}
    source.forEach(apt => {
      const day = bogotaDayStr(apt.scheduled_at)
      if (!grouped[day]) grouped[day] = []
      grouped[day].push(apt)
    })
    Object.values(grouped).forEach(apts =>
      apts.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    )
    const days = Object.keys(grouped).sort()
    return { grouped, days }
  }, [filteredAppointments])

  const pastData = useMemo(() => {
    const range = getDateRange(listRange)
    const source = filteredAppointments.filter(a => {
      const day = bogotaDayStr(a.scheduled_at)
      const isPast = day < todayForFilter
      const inRange = range ? day >= range.from && day <= range.to : true
      return isPast && inRange && (showCancelled || a.status !== 'cancelled')
    })
    const grouped: Record<string, AppointmentRecord[]> = {}
    source.forEach(apt => {
      const day = bogotaDayStr(apt.scheduled_at)
      if (!grouped[day]) grouped[day] = []
      grouped[day].push(apt)
    })
    Object.values(grouped).forEach(apts =>
      apts.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    )
    const days = Object.keys(grouped).sort().reverse()
    return { grouped, days }
  }, [filteredAppointments, listRange, showCancelled])

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
    setShowReschedule(false)
  }

  async function handleSaveNotes() {
    if (!selected) return
    setModalSaving(true)
    setModalError(null)
    try {
      const result = await updateAppointmentNotes(selected.id, modalNotes)
      if (result.error) { setModalError(result.error) } else {
        await fetchData()
        setSelected(prev => prev ? { ...prev, notes: modalNotes } : null)
      }
    } catch {
      setModalError('No tienes permiso para esta acción.')
    } finally {
      setModalSaving(false)
    }
  }

  async function handleReschedule() {
    if (!selected || !modalRescheduleDate || !modalRescheduleTime) return
    setModalSaving(true)
    setModalError(null)
    const scheduledAt = new Date(`${modalRescheduleDate}T${modalRescheduleTime}:00-05:00`).toISOString()
    const originalDuration = selected.ends_at
      ? new Date(selected.ends_at).getTime() - new Date(selected.scheduled_at).getTime()
      : 30 * 60000
    const endsAt = new Date(new Date(`${modalRescheduleDate}T${modalRescheduleTime}:00-05:00`).getTime() + originalDuration).toISOString()
    try {
      const result = await rescheduleAppointment(selected.id, scheduledAt, endsAt)
      if (result.error) {
        const msg = result.error.includes('appointments_no_overlap') || result.error.includes('23P01')
          ? 'Ese horario ya está ocupado para este médico.'
          : result.error
        setModalError(msg)
      } else {
        await fetchData()
        closeModal()
      }
    } catch {
      setModalError('No tienes permiso para esta acción.')
    } finally {
      setModalSaving(false)
    }
  }

  async function handleUpdateStatus(newStatus: 'completed' | 'no_show') {
    if (!selected) return
    setModalSaving(true)
    setModalError(null)
    const result = await updateAppointmentStatus(selected.id, newStatus)
    if (result.error) { setModalError(result.error) }
    else { await fetchData(); closeModal() }
    setModalSaving(false)
  }

  async function handleCancel() {
    if (!selected || !cancelReason.trim()) return
    setModalSaving(true)
    setModalError(null)
    try {
      // Log cancellation first, then update status
      await logCancellation(selected.id, cancelReason.trim())
      const result = await cancelAppointment(selected.id)
      if (result.error) { setModalError(result.error) } else {
        await fetchData()
        closeModal()
      }
    } catch {
      setModalError('No tienes permiso para esta acción.')
    } finally {
      setModalSaving(false)
    }
  }

  // ── Inline status change (list view badge) ────────────────────────────────

  async function handleInlineStatusChange(aptId: string, newStatus: string) {
    const prev = appointments.find(a => a.id === aptId)?.status
    // Optimistic update
    setAppointments(all => all.map(a => a.id === aptId ? { ...a, status: newStatus } : a))
    setStatusPopover(null)
    const result = await updateAppointmentStatus(aptId, newStatus as Parameters<typeof updateAppointmentStatus>[1])
    if (result.error) {
      // Revert on failure
      setAppointments(all => all.map(a => a.id === aptId ? { ...a, status: prev ?? a.status } : a))
      setStatusToast(result.error)
      setTimeout(() => setStatusToast(null), 4000)
    }
  }

  // ── Create handlers ────────────────────────────────────────────────────────

  const handleCreateAppointment = async () => {
    if (!form.doctor_id || !form.location_id || !form.scheduled_date || !form.scheduled_time) {
      setError('Completa médico, sede, fecha y hora.')
      return
    }
    if (patientMode === 'new' && !form.patient_name) {
      setError('Ingresa el nombre del paciente.')
      return
    }
    if (patientMode === 'search' && !form.lead_id) {
      setError('Selecciona un paciente.')
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
          source: 'manual',
          status: 'cita_valoracion_agendada',
          organization_id: orgId,
        }).select('id').single()
        if (leadErr || !leadData) throw leadErr || new Error('Error creando lead')
        leadId = leadData.id
      }

      const start = new Date(`${form.scheduled_date}T${form.scheduled_time}:00-05:00`)
      const selectedType = appointmentTypes.find(t => t.id === form.appointment_type_id)
      const doctor = doctors.find(d => d.id === form.doctor_id)
      const duration = selectedType?.duration_minutes ?? doctor?.metadata?.default_duration ?? 30
      const end = new Date(start.getTime() + duration * 60000)
      const price = selectedType
        ? (form.modality === 'virtual' ? (selectedType.price_virtual ?? null) : (selectedType.price_presencial ?? null))
        : null

      const { error: aptErr } = await supabase.from('appointments').insert({
        doctor_id: form.doctor_id,
        location_id: form.location_id,
        lead_id: leadId,
        organization_id: orgId,
        scheduled_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'scheduled',
        notes: form.notes || null,
        appointment_type_id: form.appointment_type_id || null,
        modality: form.modality || null,
        price: price,
      })
      if (aptErr) {
        const msg = aptErr.message?.includes('appointments_no_overlap') || (aptErr as any).code === '23P01'
          ? 'Ese horario ya está ocupado para este médico.'
          : 'No se pudo crear la cita.'
        setError(msg)
        return
      }

      setForm({ doctor_id: doctors[0]?.id ?? '', location_id: locations[0]?.id ?? '', scheduled_date: '', scheduled_time: '', patient_name: '', patient_phone: '', patient_email: '', notes: '', lead_id: '', appointment_type_id: '', modality: 'presencial' as 'presencial' | 'virtual' })
      setLeadSearch('')
      setLeadResults([])
      setCreateStep('patient')
      setPatientMode('search')
      setShowCreate(false)
      await fetchData()
    } catch {
      setError('No se pudo crear la cita.')
    } finally {
      setSaving(false)
    }
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
              {[apt.lead?.contact_name, apt.lead?.contact_last_name].filter(Boolean).join(' ') || 'Sin nombre'}
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
    const isPrevDisabled = false
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
                        {isoToLocalTime(apt.scheduled_at)} {apt.lead?.contact_name ?? '—'}
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

    const { grouped, days } = timeView === 'upcoming' ? upcomingData : pastData

    return (
      <div className="space-y-3">
        {/* Tabs Próximas / Pasadas */}
        <div className="flex items-center gap-1 mb-4">
          <button
            onClick={() => setTimeView('upcoming')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              timeView === 'upcoming' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Próximas
          </button>
          <button
            onClick={() => setTimeView('past')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              timeView === 'past' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Pasadas
          </button>
        </div>

        {/* Toggle canceladas — solo en vista pasadas */}
        {timeView === 'past' && (
          <div className="flex items-center justify-end">
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-slate-500">
              Mostrar canceladas
              <button
                onClick={() => setShowCancelled(p => !p)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showCancelled ? 'bg-blue-500' : 'bg-slate-200'}`}
              >
                <span className={`absolute left-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${showCancelled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>
          </div>
        )}

        {/* Empty state */}
        {days.length === 0 && timeView === 'upcoming' && (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">No hay citas próximas programadas.</p>
            <p className="text-xs text-slate-300 mt-1">Las citas canceladas no se muestran aquí.</p>
          </div>
        )}
        {days.length === 0 && timeView === 'past' && (
          <p className="py-12 text-center text-sm text-slate-400">No hay citas para los filtros seleccionados.</p>
        )}

        {/* Table */}
        {days.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Paciente</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Médico</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Hora</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
                </tr>
              </thead>
              {days.map((day, dayIndex) => {
                const apts = grouped[day]
                const visible = timeView === 'past' && showCancelled ? apts : apts.filter(a => a.status !== 'cancelled')
                if (visible.length === 0) return null
                const isFirst = timeView === 'upcoming' && dayIndex === 0
                return (
                  <tbody key={day} className="divide-y divide-slate-50">
                    <tr className={isFirst ? 'bg-slate-900' : 'bg-blue-50'}>
                      <td colSpan={4} className={`px-4 py-2 text-sm font-bold capitalize ${isFirst ? 'text-white' : 'text-blue-700'}`}>
                        {formatDateHeader(day)}
                      </td>
                    </tr>
                    {visible.map(apt => {
                      const cancelled = apt.status === 'cancelled'
                      const d = new Date(apt.scheduled_at)
                      return (
                        <tr
                          key={apt.id}
                          onClick={() => openModal(apt)}
                          className={`cursor-pointer transition-colors ${cancelled ? 'hover:bg-red-50/40' : 'hover:bg-slate-50'}`}
                        >
                          <td className={`py-2.5 font-medium ${cancelled ? 'pl-0 border-l-4 border-red-400' : 'px-3'}`}>
                            {cancelled && (
                              <span className={`${cancelled ? 'pl-3' : ''} ${apt.lead?.contact_name ? 'text-slate-400 line-through' : 'italic text-slate-400'}`}>
                                {[apt.lead?.contact_name, apt.lead?.contact_last_name].filter(Boolean).join(' ') || 'Paciente no disponible'}
                              </span>
                            )}
                            {!cancelled && (
                              <span className="text-slate-900">{[apt.lead?.contact_name, apt.lead?.contact_last_name].filter(Boolean).join(' ') || 'Sin nombre'}</span>
                            )}
                          </td>
                          <td className={`px-3 py-2.5 ${cancelled ? 'text-slate-400' : 'text-slate-600'}`}>
                            {apt.doctor?.metadata?.name as string || '—'}
                          </td>
                          <td className={`px-3 py-2.5 font-medium ${cancelled ? 'text-slate-400' : 'text-slate-900'}`}>
                            {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            {STATUS_TRANSITIONS[apt.status]?.length ? (
                              <button
                                onClick={e => {
                                  if (statusPopover?.aptId === apt.id) { setStatusPopover(null); return }
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                  const openUpward = window.innerHeight - rect.bottom < 200
                                  setStatusPopover({
                                    aptId: apt.id,
                                    top:        rect.bottom + 4,
                                    bottom:     window.innerHeight - rect.top + 4,
                                    left:       rect.left,
                                    openUpward,
                                  })
                                }}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-75 ${STATUS_BADGE[apt.status] ?? 'bg-slate-100 text-slate-600'}`}
                              >
                                {STATUS_LABELS[apt.status] ?? apt.status}
                                <ChevronDown className="h-3 w-3 opacity-60" />
                              </button>
                            ) : (
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                {STATUS_LABELS[apt.status] ?? apt.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Controls */}
        <div className="shrink-0 flex flex-col border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2 px-4 py-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shrink-0">
              <button
                onClick={() => setViewMode('list')}
                className={['flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                  viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'].join(' ')}
              >
                <List className="h-3.5 w-3.5" /> Lista
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={['flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                  viewMode === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'].join(' ')}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendario
              </button>
            </div>

            {!doctorId && (
              <select
                value={filterDoctor}
                onChange={e => setFilterDoctor(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los médicos</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.metadata?.name || 'Médico'}</option>
                ))}
              </select>
            )}
            {!doctorId && (
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar paciente..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex-1" />

            {!readOnly && (
              <button
                onClick={() => setShowCreate(prev => !prev)}
                className={['inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition shrink-0',
                  showCreate ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'].join(' ')}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                {showCreate ? 'Cerrar' : 'Nueva cita'}
              </button>
            )}
          </div>

          {/* Date range pills — solo en vista lista pasada */}
          {viewMode === 'list' && timeView === 'past' && (
            <div className="flex gap-1.5 flex-wrap px-4 pb-2">
              {([
                { value: 'hoy',    label: 'Hoy' },
                { value: 'semana', label: 'Esta semana' },
                { value: 'mes',    label: 'Este mes' },
                { value: 'todos',  label: 'Todos' },
              ] as const).map(r => (
                <button
                  key={r.value}
                  onClick={() => setListRange(r.value)}
                  className={['rounded-full px-3 py-1 text-xs font-medium transition',
                    listRange === r.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'].join(' ')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="shrink-0 border-b border-slate-200 bg-white overflow-hidden">
            {/* Header con steps */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setCreateStep('patient')}
                className={`flex-1 px-5 py-3.5 text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  createStep === 'patient'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className={`inline-flex h-5 w-5 rounded-full text-xs items-center justify-center font-bold ${createStep === 'patient' ? 'bg-white text-slate-900' : 'bg-slate-200 text-slate-600'}`}>1</span>
                Paciente
              </button>
              <button
                onClick={() => { if (form.lead_id || form.patient_name) setCreateStep('schedule') }}
                className={`flex-1 px-5 py-3.5 text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  createStep === 'schedule'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className={`inline-flex h-5 w-5 rounded-full text-xs items-center justify-center font-bold ${createStep === 'schedule' ? 'bg-white text-slate-900' : 'bg-slate-200 text-slate-600'}`}>2</span>
                Fecha y médico
              </button>
            </div>

            <div className="p-5">
              {/* PASO 1 — PACIENTE */}
              {createStep === 'patient' && (
                <div className="space-y-4">
                  {/* Toggle búsqueda / nuevo */}
                  <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 w-fit">
                    <button
                      onClick={() => { setPatientMode('search'); setForm(p => ({ ...p, lead_id: '', patient_name: '', patient_phone: '', patient_email: '' })) }}
                      className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${patientMode === 'search' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      Buscar existente
                    </button>
                    <button
                      onClick={() => { setPatientMode('new'); setForm(p => ({ ...p, lead_id: '' })); setLeadResults([]) }}
                      className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${patientMode === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      Paciente nuevo
                    </button>
                  </div>

                  {patientMode === 'search' ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={leadSearch}
                          onChange={e => setLeadSearch(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              const { data } = await supabase.from('leads').select('id, contact_name, contact_last_name, contact_phone').eq('organization_id', orgId).ilike('contact_name', `%${leadSearch}%`).limit(8)
                              setLeadResults(data || [])
                            }
                          }}
                          placeholder="Nombre del paciente..."
                          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={async () => {
                            const { data } = await supabase.from('leads').select('id, contact_name, contact_last_name, contact_phone').eq('organization_id', orgId).ilike('contact_name', `%${leadSearch}%`).limit(8)
                            setLeadResults(data || [])
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                        >
                          <Search className="h-3.5 w-3.5" /> Buscar
                        </button>
                      </div>
                      {leadResults.length > 0 && (
                        <div className="space-y-1">
                          {leadResults.map(lead => (
                            <button
                              key={lead.id}
                              onClick={() => {
                                setForm(p => ({ ...p, lead_id: lead.id, patient_name: lead.contact_name || '' }))
                                setLeadResults([])
                                setLeadSearch([lead.contact_name, lead.contact_last_name].filter(Boolean).join(' '))
                              }}
                              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${form.lead_id === lead.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                            >
                              <span className="font-medium text-slate-900">{[lead.contact_name, lead.contact_last_name].filter(Boolean).join(' ') || 'Sin nombre'}</span>
                              {lead.contact_phone && <span className="ml-2 text-slate-400 text-xs">{lead.contact_phone}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {form.lead_id && (
                        <p className="text-xs text-emerald-600 font-medium">✓ Paciente seleccionado</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-slate-600">Nombre completo *</label>
                        <input value={form.patient_name} onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Teléfono</label>
                        <input value={form.patient_phone} onChange={e => setForm(p => ({ ...p, patient_phone: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Email</label>
                        <input type="email" value={form.patient_email} onChange={e => setForm(p => ({ ...p, patient_email: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  )}

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        if (!form.lead_id && !form.patient_name) { setError('Selecciona o ingresa un paciente.'); return }
                        setError(null)
                        setCreateStep('schedule')
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 2 — FECHA Y MÉDICO */}
              {createStep === 'schedule' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Tipo de cita</label>
                      <select value={form.appointment_type_id} onChange={e => setForm(p => ({ ...p, appointment_type_id: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Sin tipo de cita</option>
                        {appointmentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Modalidad</label>
                      <select value={form.modality} onChange={e => setForm(p => ({ ...p, modality: e.target.value as 'presencial' | 'virtual' }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="presencial">Presencial</option>
                        <option value="virtual">Virtual</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Médico</label>
                      <select value={form.doctor_id} onChange={e => setForm(p => ({ ...p, doctor_id: e.target.value, scheduled_time: '' }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Selecciona un médico</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>{d.metadata?.name || 'Médico'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Sede</label>
                      <select value={form.location_id} onChange={e => setForm(p => ({ ...p, location_id: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Selecciona una sede</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-2 block">Fecha y hora</label>
                        <div style={{ fontSize: '0.85em' }} className="[&>div>div:first-child]:hidden">
                          <CalendarPicker
                            orgName=""
                            selectedDoctor={doctors.find(d => d.id === form.doctor_id) ?? null}
                            effectiveSchedules={schedules.filter(s => s.doctor_id === form.doctor_id)}
                            selectedDate={form.scheduled_date}
                            selectedTime={form.scheduled_time}
                            onSelect={(date, time) => {
                              setForm(p => ({ ...p, scheduled_date: date, scheduled_time: time }))
                            }}
                            doctorId={form.doctor_id}
                            minNoticeHours={0}
                            texts={{
                              org: '',
                              doctor: '',
                              autoAssign: '',
                              selected: 'Seleccionado',
                              loading: 'Cargando...',
                              noSlots: 'El médico no atiende este día',
                              docFallback: 'Médico'
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Notas (opcional)</label>
                          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            rows={6} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                        </div>
                        {form.scheduled_date && form.scheduled_time && (
                          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Resumen</p>
                            <p className="text-sm font-medium text-slate-900">{doctors.find(d => d.id === form.doctor_id)?.metadata?.name || 'Médico'}</p>
                            <p className="text-sm text-slate-600">{form.scheduled_date} · {form.scheduled_time}</p>
                            <p className="text-sm text-slate-600">{locations.find(l => l.id === form.location_id)?.name || ''}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => setCreateStep('patient')}
                      className="text-xs text-slate-500 hover:text-slate-700 transition">
                      ← Volver
                    </button>
                    <button onClick={handleCreateAppointment} disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Crear cita
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main view */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-white">
          {loading ? (
            viewMode === 'calendar' ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Cargando citas...</span>
              </div>
            ) : renderListView()
          ) : appointments.length === 0 ? (
            <div className="flex h-full items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-2xl bg-[#EBF0F6] p-3">
                  <CalendarDays className="h-12 w-12 text-[#5A9DB5]" />
                </div>
                <h2 className="text-lg font-semibold text-[#0D2B3E]">Sin citas por ahora</h2>
                <p className="text-sm text-[#4A6B7A] max-w-sm text-center">Las citas aparecerán aquí cuando alguien agende desde tu link o las crees manualmente.</p>
                {!readOnly && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="rounded-xl bg-[#215F73] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2B3E]"
                  >
                    Nueva cita
                  </button>
                )}
              </div>
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
          <div className={`relative z-10 w-full ${showReschedule ? 'max-w-2xl' : 'max-w-lg'} rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[92vh] flex flex-col`}>
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
                  <p className="font-medium text-slate-900">{[selected.lead?.contact_name, selected.lead?.contact_last_name].filter(Boolean).join(' ') || 'Sin nombre'}</p>
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
                {(selected.location?.name || modalityFromNotes(selected.notes) !== '—') && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Sede · Modalidad</p>
                    <p className="text-slate-700">
                      {[selected.location?.name, modalityFromNotes(selected.notes) !== '—' ? modalityFromNotes(selected.notes) : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Form responses */}
              {(() => {
                const meta = selected.lead?.metadata as Record<string, unknown> | null | undefined
                const aptTypeId = selected.appointment_type_id
                const fields = aptTypeId ? (formFieldsByType[aptTypeId] ?? []) : []

                function fmtVal(v: unknown): string {
                  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
                    return new Date(v + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                  }
                  return String(v ?? '')
                }
                function fmtKey(k: string): string {
                  return k.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                }

                const definedNames = new Set(fields.map(f => f.field_name))
                const rows: { label: string; value: string; wide: boolean }[] = []

                for (const f of fields) {
                  const v = meta?.[f.field_name]
                  if (v !== null && v !== undefined && v !== '') {
                    rows.push({ label: f.field_label, value: fmtVal(v), wide: f.field_type === 'textarea' })
                  }
                }
                if (meta) {
                  for (const k of Object.keys(meta)) {
                    if (definedNames.has(k)) continue
                    const v = meta[k]
                    if (v !== null && v !== undefined && v !== '') {
                      const str = fmtVal(v)
                      rows.push({ label: fmtKey(k), value: str, wide: str.includes('\n') || str.length > 80 })
                      // Insert cedula immediately after tipo-identificacion so they read together
                      if (k === 'tipo-identificacion' && selected.lead?.contact_cedula) {
                        rows.push({ label: 'Número de Identificación', value: selected.lead.contact_cedula, wide: false })
                      }
                    }
                  }
                }
                // If tipo-identificacion absent but cedula exists, add at end
                if (selected.lead?.contact_cedula && !meta?.['tipo-identificacion']) {
                  rows.push({ label: 'Número de Identificación', value: selected.lead.contact_cedula, wide: false })
                }

                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Respuestas del formulario</p>
                    {rows.length === 0 ? (
                      <p className="text-xs italic text-slate-300">Sin respuestas de formulario</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        {rows.map(row => (
                          <div key={row.label} className={row.wide ? 'col-span-2' : ''}>
                            <p className="text-xs text-slate-400">{row.label}</p>
                            <p className="text-sm font-medium text-slate-700">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

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
                  <button
                    onClick={() => setShowReschedule(v => !v)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Reagendar cita
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showReschedule ? 'rotate-180' : ''}`} />
                  </button>
                  {showReschedule && (
                    <div className="mt-3 space-y-3">
                      <div className="w-full overflow-x-hidden overflow-hidden" style={{ fontSize: '0.85em' }}>
                        <CalendarPicker
                          orgName=""
                          selectedDoctor={selected.doctor as any ?? null}
                          effectiveSchedules={schedules.filter(s => s.doctor_id === selected.doctor_id)}
                          selectedDate={modalRescheduleDate}
                          selectedTime={modalRescheduleTime}
                          onSelect={(date, time) => { setModalRescheduleDate(date); setModalRescheduleTime(time) }}
                          doctorId={selected.doctor_id}
                          minNoticeHours={0}
                          texts={{ org: 'Org', doctor: 'Médico', autoAssign: 'Sin asignar', selected: 'Seleccionado', loading: 'Cargando...', noSlots: 'Sin horarios disponibles.', docFallback: 'Médico' }}
                        />
                      </div>
                      <button onClick={handleReschedule} disabled={modalSaving || !modalRescheduleDate || !modalRescheduleTime}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50">
                        {modalSaving ? 'Guardando...' : 'Guardar reagendamiento'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {modalError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p>
              )}

              {/* Actions — only for scheduled appointments */}
              {selected.status === 'scheduled' && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStatus('completed')}
                      disabled={modalSaving}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Completada
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('no_show')}
                      disabled={modalSaving}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 transition disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> No asistió
                    </button>
                  </div>

                  {!showCancelConfirm ? (
                    <button onClick={() => setShowCancelConfirm(true)}
                      className="text-xs text-rose-500 hover:text-rose-700 transition underline-offset-2 hover:underline">
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

              <AppointmentActivity appointmentId={selected.id} />
            </div>
          </div>
        </div>
      )}

      {/* Inline status popover */}
      {statusPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setStatusPopover(null)} />
          <div
            className="fixed z-50 min-w-[150px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            style={statusPopover.openUpward
              ? { bottom: statusPopover.bottom, left: statusPopover.left }
              : { top: statusPopover.top,       left: statusPopover.left }}
          >
            {(STATUS_TRANSITIONS[appointments.find(a => a.id === statusPopover.aptId)?.status ?? ''] ?? []).map(opt => (
              <button
                key={opt.value}
                onClick={() => handleInlineStatusChange(statusPopover.aptId, opt.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotColor(opt.value)}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Error toast for inline status update failures */}
      {statusToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl bg-red-600 px-5 py-3 text-sm text-white shadow-lg">
          {statusToast}
        </div>
      )}
    </>
  )
}
