'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, X, AlertTriangle, Loader2 } from 'lucide-react'
import {
  cancelAppointment,
  updateAppointmentNotes,
  rescheduleAppointment,
} from '@/app/(app)/scheduling/actions'

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
  // Supabase returns many-to-one joins as single objects, not arrays
  lead?: { contact_name: string | null; contact_phone: string | null; contact_email: string | null } | null
  doctor?: { metadata: Record<string, unknown> | null } | null
  location?: { name: string } | null
}

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

const ROW_BG: Record<string, string> = {
  scheduled: 'bg-blue-50/50',
  confirmed: 'bg-sky-50/50',
  completed: 'bg-emerald-50/50',
  cancelled: 'opacity-50',
  no_show: 'bg-red-50/50',
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

export function CalendarClient() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [filterDoctor, setFilterDoctor] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [search, setSearch] = useState('')
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
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Detail modal state
  const [selected, setSelected] = useState<AppointmentRecord | null>(null)
  const [modalNotes, setModalNotes] = useState('')
  const [modalRescheduleDate, setModalRescheduleDate] = useState('')
  const [modalRescheduleTime, setModalRescheduleTime] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    const [
      { data: doctorData, error: doctorError },
      { data: locationData, error: locationError },
      { data: appointmentData, error: appointmentError },
    ] = await Promise.all([
      supabase
        .from('doctors')
        .select('id, specialty, is_active, metadata')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      supabase.from('locations').select('id, name').order('name', { ascending: true }),
      supabase
        .from('appointments')
        .select(
          'id, scheduled_at, ends_at, status, doctor_id, lead_id, location_id, notes, doctor:doctor_id(metadata), lead:lead_id(contact_name,contact_phone,contact_email), location:location_id(name)'
        )
        .order('scheduled_at', { ascending: true }),
    ])

    if (doctorError || locationError || appointmentError) {
      setError(
        doctorError?.message ||
          locationError?.message ||
          appointmentError?.message ||
          'Error cargando datos'
      )
      setLoading(false)
      return
    }

    setDoctors(doctorData || [])
    setLocations(locationData || [])
    setAppointments((appointmentData as unknown as AppointmentRecord[]) || [])

    if (!form.doctor_id && doctorData?.length) {
      setForm((prev) => ({ ...prev, doctor_id: doctorData[0].id }))
    }
    if (!form.location_id && locationData?.length) {
      setForm((prev) => ({ ...prev, location_id: locationData[0].id }))
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((apt) => {
        const matchesDoctor = !filterDoctor || apt.doctor_id === filterDoctor
        const matchesLocation = !filterLocation || apt.location_id === filterLocation
        const matchesSearch =
          !search ||
          apt.lead?.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
          apt.lead?.contact_phone?.includes(search)
        return matchesDoctor && matchesLocation && matchesSearch
      }),
    [appointments, filterDoctor, filterLocation, search]
  )

  // ── Modal handlers ──────────────────────────────────────────────────────────

  function openModal(apt: AppointmentRecord) {
    setSelected(apt)
    setModalNotes(apt.notes ?? '')
    setModalRescheduleDate(isoToLocalDate(apt.scheduled_at))
    setModalRescheduleTime(isoToLocalTime(apt.scheduled_at))
    setModalError(null)
    setShowCancelConfirm(false)
  }

  function closeModal() {
    setSelected(null)
    setModalSaving(false)
    setModalError(null)
    setShowCancelConfirm(false)
  }

  async function handleSaveNotes() {
    if (!selected) return
    setModalSaving(true)
    setModalError(null)
    const result = await updateAppointmentNotes(selected.id, modalNotes)
    if (result.error) {
      setModalError(result.error)
    } else {
      await fetchData()
      setSelected((prev) => (prev ? { ...prev, notes: modalNotes } : null))
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
    if (result.error) {
      setModalError(result.error)
    } else {
      await fetchData()
      setSelected((prev) =>
        prev ? { ...prev, scheduled_at: scheduledAt, ends_at: endsAt } : null
      )
    }
    setModalSaving(false)
  }

  async function handleCancel() {
    if (!selected) return
    setModalSaving(true)
    setModalError(null)
    const result = await cancelAppointment(selected.id)
    if (result.error) {
      setModalError(result.error)
    } else {
      await fetchData()
      closeModal()
    }
    setModalSaving(false)
  }

  // ── Create appointment handlers ─────────────────────────────────────────────

  const handleSearchLeads = async () => {
    if (!form.lead_search) { setLeads([]); return }
    const { data } = await supabase
      .from('leads')
      .select('id, contact_name, contact_phone')
      .ilike('contact_name', `%${form.lead_search}%`)
      .order('created_at', { ascending: false })
      .limit(10)
    setLeads(data || [])
  }

  const handleSelectLead = (lead: any) => {
    setForm((prev) => ({
      ...prev,
      lead_id: lead.id,
      patient_name: lead.contact_name || '',
      patient_phone: lead.contact_phone || '',
      lead_search: '',
    }))
    setLeads([])
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
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .insert({
            contact_name: form.patient_name,
            contact_phone: form.patient_phone || null,
            contact_email: form.patient_email || null,
            source: 'manual',
            status: 'new',
            notes: form.notes || null,
          })
          .select('id')
          .single()
        if (leadError || !leadData) throw leadError || new Error('Error creando el lead')
        leadId = leadData.id
      }
      const start = new Date(form.scheduled_at)
      const end = new Date(start.getTime() + 30 * 60000)
      const { error: aptError } = await supabase.from('appointments').insert({
        doctor_id: form.doctor_id,
        location_id: form.location_id,
        lead_id: leadId,
        scheduled_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'scheduled',
        notes: form.notes || null,
      })
      if (aptError) throw aptError
      setForm((prev) => ({
        ...prev,
        lead_search: '',
        lead_id: '',
        patient_name: '',
        patient_phone: '',
        patient_email: '',
        notes: '',
      }))
      setLeads([])
      setShowCreate(false)
      await fetchData()
    } catch {
      setError('No se pudo crear la cita.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-4">
        {/* Header + filters bar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {/* Top row: title + new appointment button */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Calendario de citas</h2>
              <p className="mt-0.5 text-sm text-slate-500 hidden sm:block">
                Haz clic en una cita para ver detalles y acciones.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{showCreate ? 'Ocultar' : 'Nueva cita'}</span>
              <span className="sm:hidden">Nueva</span>
            </button>
          </div>

          {/* Filters row */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los médicos</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.metadata?.name || 'Médico'}</option>
              ))}
            </select>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las sedes</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Nueva cita manual</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Médico</label>
                <select
                  value={form.doctor_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, doctor_id: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                >
                  <option value="">Selecciona un médico</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.metadata?.name || 'Médico'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Sede</label>
                <select
                  value={form.location_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, location_id: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                >
                  <option value="">Selecciona una sede</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Fecha y hora</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Nombre del paciente</label>
                <input
                  value={form.patient_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, patient_name: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Teléfono</label>
                <input
                  value={form.patient_phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, patient_phone: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={form.patient_email}
                  onChange={(e) => setForm((prev) => ({ ...prev, patient_email: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Buscar lead existente</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={form.lead_search}
                    onChange={(e) => setForm((prev) => ({ ...prev, lead_search: e.target.value }))}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                    placeholder="Nombre del paciente"
                  />
                  <button
                    type="button"
                    onClick={handleSearchLeads}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">Buscar</span>
                  </button>
                </div>
                {leads.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {leads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => handleSelectLead(lead)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm hover:bg-slate-100"
                      >
                        {lead.contact_name || 'Sin nombre'} · {lead.contact_phone || 'Sin teléfono'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateAppointment}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Crear cita
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Appointments list */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Count */}
          <div className="px-4 py-3 border-b border-slate-100 sm:px-6">
            <p className="text-sm text-slate-500">
              {loading ? 'Cargando...' : `${filteredAppointments.length} cita${filteredAppointments.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Cargando citas...</span>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                No hay citas para los filtros seleccionados.
              </p>
            ) : (
              filteredAppointments.map((apt) => {
                const d = new Date(apt.scheduled_at)
                const isCancelled = apt.status === 'cancelled'
                return (
                  <button
                    key={apt.id}
                    onClick={() => openModal(apt)}
                    className={`w-full text-left px-4 py-4 hover:bg-slate-50 transition-colors ${ROW_BG[apt.status] ?? ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`font-medium text-slate-900 text-sm truncate ${isCancelled ? 'line-through text-slate-400' : ''}`}>
                          {apt.lead?.contact_name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {apt.doctor?.metadata?.name as string || 'Médico'}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[apt.status] ?? apt.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span className="capitalize">
                        {d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span>·</span>
                      <span>{d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>·</span>
                      <span>{modalityFromNotes(apt.notes)}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Paciente</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Médico</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Hora</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Modalidad</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando citas...
                      </span>
                    </td>
                  </tr>
                ) : filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                      No hay citas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((apt) => {
                    const d = new Date(apt.scheduled_at)
                    const isCancelled = apt.status === 'cancelled'
                    return (
                      <tr
                        key={apt.id}
                        onClick={() => openModal(apt)}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${ROW_BG[apt.status] ?? ''}`}
                      >
                        <td className="px-5 py-3.5">
                          <p className={`font-medium text-slate-900 ${isCancelled ? 'line-through text-slate-400' : ''}`}>
                            {apt.lead?.contact_name || 'Sin nombre'}
                          </p>
                          {apt.lead?.contact_phone && (
                            <p className="text-xs text-slate-400 mt-0.5">{apt.lead.contact_phone}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">
                          {apt.doctor?.metadata?.name as string || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 capitalize">
                          {d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900">
                          {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {modalityFromNotes(apt.notes)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_LABELS[apt.status] ?? apt.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Appointment detail modal ──────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

          {/* Panel — slides up from bottom on mobile, centered on desktop */}
          <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Detalle de cita</h2>
                <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[selected.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1">
              {/* Patient info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Paciente</p>
                  <p className="font-medium text-slate-900">{selected.lead?.contact_name || 'Sin nombre'}</p>
                  {selected.lead?.contact_phone && (
                    <p className="text-slate-500 mt-0.5">{selected.lead.contact_phone}</p>
                  )}
                  {selected.lead?.contact_email && (
                    <p className="text-slate-500 text-xs mt-0.5">{selected.lead.contact_email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Médico</p>
                  <p className="font-medium text-slate-900">
                    {(selected.doctor?.metadata?.name as string) || 'Sin asignar'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Fecha y hora</p>
                  <p className="font-medium text-slate-900">
                    {new Date(selected.scheduled_at).toLocaleString('es-CO', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Sede</p>
                  <p className="text-slate-700">{selected.location?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Modalidad</p>
                  <p className="text-slate-700">{modalityFromNotes(selected.notes)}</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sin notas..."
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={modalSaving}
                  className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {modalSaving ? 'Guardando...' : 'Guardar notas'}
                </button>
              </div>

              {/* Reschedule — split date + time */}
              {!['cancelled', 'completed'].includes(selected.status) && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reagendar</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={modalRescheduleDate}
                      onChange={(e) => setModalRescheduleDate(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="time"
                      value={modalRescheduleTime}
                      onChange={(e) => setModalRescheduleTime(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleReschedule}
                    disabled={modalSaving || !modalRescheduleDate || !modalRescheduleTime}
                    className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {modalSaving ? 'Guardando...' : 'Confirmar reagendamiento'}
                  </button>
                </div>
              )}

              {/* Error */}
              {modalError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p>
              )}

              {/* Cancel */}
              {!['cancelled', 'completed'].includes(selected.status) && (
                <div className="border-t border-slate-100 pt-4">
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 transition"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Cancelar esta cita
                    </button>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-slate-700">¿Seguro que deseas cancelar esta cita?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancel}
                          disabled={modalSaving}
                          className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600 transition disabled:opacity-50"
                        >
                          {modalSaving ? 'Cancelando...' : 'Sí, cancelar'}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          No, volver
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
