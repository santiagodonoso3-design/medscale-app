'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check } from 'lucide-react'

// DB: day_of_week 0-6  (0=Dom, 1=Lun … 6=Sáb)
const DAYS = [
  { label: 'Lunes',      value: 1 },
  { label: 'Martes',     value: 2 },
  { label: 'Miércoles',  value: 3 },
  { label: 'Jueves',     value: 4 },
  { label: 'Viernes',    value: 5 },
  { label: 'Sábado',     value: 6 },
  { label: 'Domingo',    value: 0 },
]

type DayState = { enabled: boolean; start_time: string; end_time: string }
type Week = Record<number, DayState>

function emptyWeek(): Week {
  return Object.fromEntries(
    DAYS.map(d => [d.value, { enabled: false, start_time: '08:00', end_time: '17:00' }])
  )
}

export function AvailabilityEditor() {
  const [doctors, setDoctors]           = useState<any[]>([])
  const [locations, setLocations]       = useState<any[]>([])
  const [doctorId, setDoctorId]         = useState('')
  const [locationId, setLocationId]     = useState('')
  const [week, setWeek]                 = useState<Week>(emptyWeek)
  const [loadingMeta, setLoadingMeta]   = useState(true)
  const [loadingSched, setLoadingSched] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const supabase = createClient()

  // ── Load doctors + locations once ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [{ data: dData }, { data: lData }] = await Promise.all([
        supabase.from('doctors').select('id, metadata').order('created_at', { ascending: true }),
        supabase.from('locations').select('id, name').order('name', { ascending: true }),
      ])
      setDoctors(dData ?? [])
      setLocations(lData ?? [])
      if (dData?.length) setDoctorId(dData[0].id)
      if (lData?.length) setLocationId(lData[0].id)
      setLoadingMeta(false)
    }
    load()
  }, [])

  // ── Load schedule whenever doctor changes ──────────────────────────────────
  useEffect(() => {
    if (!doctorId) return
    const load = async () => {
      setLoadingSched(true)
      const fresh = emptyWeek()
      const { data } = await supabase
        .from('schedules')
        .select('day_of_week, start_time, end_time, location_id')
        .eq('doctor_id', doctorId)
      if (data?.length) {
        // Use location from first schedule row if available
        const firstLoc = data.find(r => r.location_id)?.location_id
        if (firstLoc) setLocationId(firstLoc)
        data.forEach(row => {
          if (fresh[row.day_of_week] !== undefined) {
            fresh[row.day_of_week] = {
              enabled: true,
              start_time: row.start_time ?? '08:00',
              end_time: row.end_time ?? '17:00',
            }
          }
        })
      }
      setWeek(fresh)
      setLoadingSched(false)
    }
    load()
  }, [doctorId])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggle = (day: number) =>
    setWeek(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))

  const setTime = (day: number, field: 'start_time' | 'end_time', val: string) =>
    setWeek(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))

  const handleSave = async () => {
    if (!doctorId) { setError('Selecciona un médico.'); return }
    setSaving(true)
    setError(null)

    // Delete all existing rows for this doctor
    const { error: delErr } = await supabase
      .from('schedules')
      .delete()
      .eq('doctor_id', doctorId)
    if (delErr) { setError(delErr.message); setSaving(false); return }

    // Insert enabled days
    const rows = DAYS.filter(d => week[d.value].enabled).map(d => ({
      doctor_id:    doctorId,
      location_id:  locationId || null,
      day_of_week:  d.value,
      start_time:   week[d.value].start_time,
      end_time:     week[d.value].end_time,
      active:       true,
      is_recurring: true,
    }))

    if (rows.length) {
      const { error: insErr } = await supabase.from('schedules').insert(rows)
      if (insErr) { setError(insErr.message); setSaving(false); return }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingMeta) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      {/* ── Selectors ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Médico
            </label>
            <select
              value={doctorId}
              onChange={e => setDoctorId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {(d.metadata?.name as string) ?? 'Médico sin nombre'}
                </option>
              ))}
            </select>
          </div>
          {locations.length > 0 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sede
              </label>
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── 7-day list ─────────────────────────────────────────────────────── */}
      {loadingSched ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando horario...</span>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {DAYS.map(({ label, value }) => {
            const day = week[value]
            return (
              <div
                key={value}
                className={[
                  'flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 transition-opacity',
                  day.enabled ? 'opacity-100' : 'opacity-40',
                ].join(' ')}
              >
                {/* Toggle pill */}
                <button
                  type="button"
                  onClick={() => toggle(value)}
                  aria-pressed={day.enabled}
                  className={[
                    'relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    day.enabled ? 'bg-blue-600' : 'bg-slate-200',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                      day.enabled ? 'translate-x-4' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </button>

                {/* Day name */}
                <span
                  className={[
                    'w-24 shrink-0 text-sm font-medium',
                    day.enabled ? 'text-slate-900' : 'text-slate-400',
                  ].join(' ')}
                >
                  {label}
                </span>

                {/* Time inputs or placeholder */}
                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.start_time}
                      onChange={e => setTime(value, 'start_time', e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-400">—</span>
                    <input
                      type="time"
                      value={day.end_time}
                      onChange={e => setTime(value, 'end_time', e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-slate-300">Sin atención</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <span className="text-sm">
          {error && <span className="text-red-600">{error}</span>}
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <Check className="h-4 w-4" />
              Horario guardado
            </span>
          )}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || loadingSched}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar horario
        </button>
      </div>
    </div>
  )
}
