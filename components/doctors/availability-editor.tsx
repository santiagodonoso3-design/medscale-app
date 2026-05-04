'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check, Plus, Trash2 } from 'lucide-react'

// DB: day_of_week 0-6  (0=Dom, 1=Lun … 6=Sáb)
const DAYS = [
  { label: 'Lunes',     value: 1 },
  { label: 'Martes',    value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves',    value: 4 },
  { label: 'Viernes',   value: 5 },
  { label: 'Sábado',    value: 6 },
  { label: 'Domingo',   value: 0 },
]

type DayState  = { enabled: boolean; start_time: string; end_time: string }
type Week      = Record<number, DayState>

type ExRow = {
  id: string
  specific_date: string   // YYYY-MM-DD
  active: boolean         // true = available w/ hours, false = not available
  start_time: string | null
  end_time:   string | null
}

const EMPTY_EX = { date: '', noAttend: false, start_time: '08:00', end_time: '17:00' }

function emptyWeek(): Week {
  return Object.fromEntries(
    DAYS.map(d => [d.value, { enabled: false, start_time: '08:00', end_time: '17:00' }])
  )
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso + 'T12:00:00Z'))
}

// ── Component ───────────────────────────────────────────────────────────────

export function AvailabilityEditor() {
  const [doctors,      setDoctors]      = useState<any[]>([])
  const [locations,    setLocations]    = useState<any[]>([])
  const [doctorId,     setDoctorId]     = useState('')
  const [locationId,   setLocationId]   = useState('')
  const [week,         setWeek]         = useState<Week>(emptyWeek)
  const [exceptions,   setExceptions]   = useState<ExRow[]>([])
  const [loadingMeta,  setLoadingMeta]  = useState(true)
  const [loadingSched, setLoadingSched] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // exception form
  const [showExForm, setShowExForm] = useState(false)
  const [exForm,     setExForm]     = useState(EMPTY_EX)
  const [savingEx,   setSavingEx]   = useState(false)
  const [exError,    setExError]    = useState<string | null>(null)

  const supabase = createClient()

  // ── Load doctors + locations ─────────────────────────────────────────��─────
  useEffect(() => {
    const load = async () => {
      const [{ data: dData }, { data: lData }] = await Promise.all([
        supabase.from('doctors').select('id, metadata').order('created_at', { ascending: true }),
        supabase.from('locations').select('id, name').order('name', { ascending: true }),
      ])
      setDoctors(dData ?? [])
      setLocations(lData ?? [])
      if (dData?.length)  setDoctorId(dData[0].id)
      if (lData?.length)  setLocationId(lData[0].id)
      setLoadingMeta(false)
    }
    load()
  }, [])

  // ── Load recurring schedule + exceptions when doctor changes ──────────────
  useEffect(() => {
    if (!doctorId) return
    const load = async () => {
      setLoadingSched(true)
      const fresh = emptyWeek()

      // recurring schedules
      const { data: recurring } = await supabase
        .from('schedules')
        .select('day_of_week, start_time, end_time, location_id')
        .eq('doctor_id', doctorId)
        .eq('is_recurring', true)

      if (recurring?.length) {
        const firstLoc = recurring.find((r: any) => r.location_id)?.location_id
        if (firstLoc) setLocationId(firstLoc)
        recurring.forEach((row: any) => {
          if (fresh[row.day_of_week] !== undefined) {
            fresh[row.day_of_week] = {
              enabled: true,
              start_time: row.start_time ?? '08:00',
              end_time:   row.end_time   ?? '17:00',
            }
          }
        })
      }
      setWeek(fresh)

      // exceptions (non-recurring with specific_date)
      const { data: exData } = await supabase
        .from('schedules')
        .select('id, specific_date, start_time, end_time, active')
        .eq('doctor_id', doctorId)
        .eq('is_recurring', false)
        .order('specific_date', { ascending: true })
      setExceptions((exData as ExRow[]) ?? [])

      setLoadingSched(false)
    }
    load()
  }, [doctorId])

  // ── Weekly handlers ────────────────────────────────────────────────────────
  const toggle = (day: number) =>
    setWeek(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))

  const setTime = (day: number, field: 'start_time' | 'end_time', val: string) =>
    setWeek(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))

  const handleSave = async () => {
    if (!doctorId) { setError('Selecciona un médico.'); return }
    setSaving(true)
    setError(null)

    // Delete only recurring rows — preserve exceptions
    const { error: delErr } = await supabase
      .from('schedules')
      .delete()
      .eq('doctor_id', doctorId)
      .eq('is_recurring', true)
    if (delErr) { setError(delErr.message); setSaving(false); return }

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

  // ── Exception handlers ─────────────────────────────────────────────────────
  const refreshExceptions = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('id, specific_date, start_time, end_time, active')
      .eq('doctor_id', doctorId)
      .eq('is_recurring', false)
      .order('specific_date', { ascending: true })
    setExceptions((data as ExRow[]) ?? [])
  }

  const handleAddException = async () => {
    if (!exForm.date) { setExError('Selecciona una fecha.'); return }
    setSavingEx(true)
    setExError(null)

    const { error } = await supabase.from('schedules').insert({
      doctor_id:     doctorId,
      location_id:   locationId || null,
      specific_date: exForm.date,
      day_of_week:   null,
      start_time:    exForm.noAttend ? null : exForm.start_time,
      end_time:      exForm.noAttend ? null : exForm.end_time,
      active:        !exForm.noAttend,
      is_recurring:  false,
    } as any)

    if (error) { setExError(error.message); setSavingEx(false); return }

    await refreshExceptions()
    setExForm(EMPTY_EX)
    setShowExForm(false)
    setSavingEx(false)
  }

  const handleDeleteException = async (id: string) => {
    await supabase.from('schedules').delete().eq('id', id)
    setExceptions(prev => prev.filter(e => e.id !== id))
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
    <div className="space-y-5">

      {/* ── Weekly schedule ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">

        {/* Selectors */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Médico</label>
              <select
                value={doctorId}
                onChange={e => setDoctorId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{(d.metadata?.name as string) ?? 'Médico sin nombre'}</option>
                ))}
              </select>
            </div>
            {locations.length > 0 && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sede</label>
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

        {/* 7-day list */}
        {loadingSched ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Cargando horario...</span>
          </div>
        ) : (
          <div>
            {DAYS.map(({ label, value }) => {
              const day = week[value]
              return (
                <div
                  key={value}
                  className="flex items-center gap-4 border-b border-slate-100 px-6 py-3 last:border-0"
                >
                  {/* Toggle pill */}
                  <button
                    type="button"
                    onClick={() => toggle(value)}
                    aria-pressed={day.enabled}
                    className={[
                      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                      day.enabled ? 'bg-blue-600' : 'bg-slate-200',
                    ].join(' ')}
                  >
                    <span className={[
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      day.enabled ? 'translate-x-6' : 'translate-x-1',
                    ].join(' ')} />
                  </button>

                  {/* Day name */}
                  <span className={[
                    'w-24 shrink-0 text-sm font-medium',
                    day.enabled ? 'text-slate-900' : 'text-slate-400',
                  ].join(' ')}>
                    {label}
                  </span>

                  {/* Hours or placeholder */}
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
                    <span className="text-sm text-slate-400">Sin atención</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Save footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-sm">
            {error && <span className="text-red-600">{error}</span>}
            {saved && (
              <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                <Check className="h-4 w-4" /> Horario guardado
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

      {/* ── Excepciones de fechas ─────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Excepciones de fechas</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Días con horario diferente o sin atención
            </p>
          </div>
          {!showExForm && (
            <button
              onClick={() => { setShowExForm(true); setExError(null) }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar excepción
            </button>
          )}
        </div>

        {/* Inline add form */}
        {showExForm && (
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5 space-y-4">
            {/* Date picker */}
            <div className="max-w-xs">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fecha
              </label>
              <input
                type="date"
                value={exForm.date}
                onChange={e => setExForm(p => ({ ...p, date: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Attendance pills */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExForm(p => ({ ...p, noAttend: false }))}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                  !exForm.noAttend
                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                ].join(' ')}
              >
                Atiendo este día
              </button>
              <button
                type="button"
                onClick={() => setExForm(p => ({ ...p, noAttend: true }))}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                  exForm.noAttend
                    ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                ].join(' ')}
              >
                No atiendo este día
              </button>
            </div>

            {/* Time inputs — only when attending */}
            {!exForm.noAttend && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Horario
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="time"
                    value={exForm.start_time}
                    onChange={e => setExForm(p => ({ ...p, start_time: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-400">—</span>
                  <input
                    type="time"
                    value={exForm.end_time}
                    onChange={e => setExForm(p => ({ ...p, end_time: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {exError && <p className="text-sm text-red-600">{exError}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleAddException}
                disabled={savingEx}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {savingEx && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar
              </button>
              <button
                onClick={() => { setShowExForm(false); setExForm(EMPTY_EX); setExError(null) }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Exception list */}
        {loadingSched ? null : exceptions.length === 0 && !showExForm ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-400">Sin excepciones configuradas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {exceptions.map(ex => (
              <div key={ex.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium capitalize text-slate-900">
                    {fmtDate(ex.specific_date)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {ex.active && ex.start_time && ex.end_time
                      ? `${ex.start_time.slice(0, 5)} — ${ex.end_time.slice(0, 5)}`
                      : 'No disponible'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteException(ex.id)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
