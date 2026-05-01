'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Clock3, Plus, Search } from 'lucide-react'

type AppointmentRecord = {
  id: string
  scheduled_at: string
  ends_at: string | null
  status: string
  notes: string | null
  doctor_id: string
  lead_id: string | null
  location_id: string | null
  metadata: Record<string, any> | null
  lead?: { contact_name: string | null; contact_phone: string | null }[]
  doctor?: { metadata: Record<string, any> | null }[]
}

const statusLabels: Record<string, string> = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No show',
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

  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    const [{ data: doctorData, error: doctorError }, { data: locationData, error: locationError }, { data: appointmentData, error: appointmentError }] = await Promise.all([
      supabase.from('doctors').select('id, specialty, is_active, metadata').eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('locations').select('id, name').order('name', { ascending: true }),
      supabase
        .from('appointments')
        .select('id, scheduled_at, ends_at, status, doctor_id, lead_id, location_id, notes, doctor:doctor_id(metadata), lead:lead_id(contact_name,contact_phone)')
        .order('scheduled_at', { ascending: true }),
    ])

    if (doctorError || locationError || appointmentError) {
      setError(doctorError?.message || locationError?.message || appointmentError?.message || 'Error cargando datos')
      setLoading(false)
      return
    }

    setDoctors(doctorData || [])
    setLocations(locationData || [])
    setAppointments((appointmentData as AppointmentRecord[]) || [])

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
      appointments.filter((appointment) => {
        const matchesDoctor = !filterDoctor || appointment.doctor_id === filterDoctor
        const matchesLocation = !filterLocation || appointment.location_id === filterLocation
        const matchesSearch =
          !search ||
          appointment.lead?.[0]?.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
          appointment.lead?.[0]?.contact_phone?.includes(search)
        return matchesDoctor && matchesLocation && matchesSearch
      }),
    [appointments, filterDoctor, filterLocation, search]
  )

  const handleSearchLeads = async () => {
    if (!form.lead_search) {
      setLeads([])
      return
    }

    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_phone')
      .ilike('contact_name', `%${form.lead_search}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (leadError) {
      console.error(leadError)
      return
    }

    setLeads(leadData || [])
  }

  const handleSelectLead = (lead: any) => {
    setForm((prev) => ({
      ...prev,
      lead_id: lead.id,
      patient_name: lead.contact_name || '',
      patient_phone: lead.contact_phone || '',
      lead_search: '',
    }))
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

        if (leadError || !leadData) {
          throw leadError || new Error('Error creando el lead')
        }

        leadId = leadData.id
      }

      const start = new Date(form.scheduled_at)
      const end = new Date(start.getTime() + 30 * 60000)

      const { error: appointmentError } = await supabase.from('appointments').insert({
        doctor_id: form.doctor_id,
        location_id: form.location_id,
        lead_id: leadId,
        scheduled_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'scheduled',
        notes: form.notes || null,
      })

      if (appointmentError) {
        throw appointmentError
      }

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
    } catch (err) {
      console.error(err)
      setError('No se pudo crear la cita.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Calendario de citas</h2>
            <p className="mt-2 text-sm text-slate-600">Visualiza y crea citas manuales para tus médicos y sedes.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {showCreate ? 'Ocultar formulario' : 'Crear cita manual'}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Médico</label>
              <select
                value={form.doctor_id}
                onChange={(event) => setForm((prev) => ({ ...prev, doctor_id: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              >
                <option value="">Selecciona un médico</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.metadata?.name || 'Médico sin nombre'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Sede</label>
              <select
                value={form.location_id}
                onChange={(event) => setForm((prev) => ({ ...prev, location_id: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              >
                <option value="">Selecciona una sede</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Fecha y hora</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(event) => setForm((prev) => ({ ...prev, scheduled_at: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Nombre del paciente</label>
              <input
                value={form.patient_name}
                onChange={(event) => setForm((prev) => ({ ...prev, patient_name: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Teléfono</label>
              <input
                value={form.patient_phone}
                onChange={(event) => setForm((prev) => ({ ...prev, patient_phone: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={form.patient_email}
                onChange={(event) => setForm((prev) => ({ ...prev, patient_email: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-700">Buscar lead existente</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={form.lead_search}
                  onChange={(event) => setForm((prev) => ({ ...prev, lead_search: event.target.value }))}
                  className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                  placeholder="Nombre o teléfono"
                />
                <button
                  type="button"
                  onClick={handleSearchLeads}
                  className="inline-flex items-center gap-2 rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Search className="h-4 w-4" />
                  Buscar
                </button>
              </div>
              {leads.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {leads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => handleSelectLead(lead)}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-100"
                    >
                      {lead.contact_name || 'Lead sin nombre'} · {lead.contact_phone || 'Sin teléfono'}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-700">Notas</label>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
            </div>
            {error && <p className="text-sm text-red-600 lg:col-span-2">{error}</p>}
            <div className="lg:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={handleCreateAppointment}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Crear cita
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Citas programadas</h3>
            <p className="mt-1 text-sm text-slate-600">Filtra por médico, sede y paciente.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={filterDoctor}
              onChange={(event) => setFilterDoctor(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Todos los médicos</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.metadata?.name || 'Médico'}
                </option>
              ))}
            </select>
            <select
              value={filterLocation}
              onChange={(event) => setFilterLocation(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Todas las sedes</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar paciente"
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            />
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Médico</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Cargando citas...
                  </td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No hay citas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appointment) => {
                  const scheduled = new Date(appointment.scheduled_at)
                  return (
                    <tr key={appointment.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-4 text-slate-900">{appointment.lead?.[0]?.contact_name || 'Paciente sin nombre'}</td>
                      <td className="px-4 py-4 text-slate-900">{appointment.doctor?.[0]?.metadata?.name || 'Médico'}</td>
                      <td className="px-4 py-4 text-slate-700">{scheduled.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="px-4 py-4 text-slate-700">{scheduled.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${appointment.status === 'scheduled' ? 'bg-amber-100 text-amber-800' : appointment.status === 'confirmed' ? 'bg-sky-100 text-sky-800' : appointment.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {statusLabels[appointment.status] || appointment.status}
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
  )
}
