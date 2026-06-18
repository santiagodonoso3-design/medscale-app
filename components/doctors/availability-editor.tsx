'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check, Plus, Trash2, Lock, X } from 'lucide-react'
import { DateRangePicker } from '@/components/ui/date-range-picker'

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

type TimeBlock = { start_time: string; end_time: string }
type DayState  = { enabled: boolean; blocks: TimeBlock[] }
type Week      = Record<number, DayState>

type ExRow = {
  id: string
  specific_date: string
  active: boolean
  start_time: string | null
  end_time:   string | null
}

function emptyWeek(): Week {
  return Object.fromEntries(
    DAYS.map(d => [d.value, { enabled: false, blocks: [{ start_time: '08:00', end_time: '17:00' }] }])
  )
}

function expandDateRange(from: string, to: string | null): string[] {
  if (!to || to <= from) return [from]
  const dates: string[] = []
  const cur = new Date(from + 'T12:00:00Z')
  const end = new Date(to + 'T12:00:00Z')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'UTC',
  }).format(new Date(iso + 'T12:00:00Z'))
}

// ── Component ────────────────────────────────────────────────────────────────

interface AvailabilityEditorProps {
  orgId: string
}

export function AvailabilityEditor({ orgId }: AvailabilityEditorProps) {
  // meta
  const [doctors,      setDoctors]      = useState<any[]>([])
  const [locations,    setLocations]    = useState<any[]>([])
  const [doctorId,     setDoctorId]     = useState('')
  const [locationId,   setLocationId]   = useState('')
  const [loadingMeta,  setLoadingMeta]  = useState(true)

  // weekly schedule
  const [week,         setWeek]         = useState<Week>(emptyWeek)
  const [loadingSched, setLoadingSched] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [weekError,    setWeekError]    = useState<string | null>(null)

  // non-recurring rows (split by active in render)
  const [exceptions,   setExceptions]   = useState<ExRow[]>([])

  // "Días adicionales" form (active = true)
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [addForm,      setAddForm]      = useState({ date_from: '', date_to: '', start_time: '08:00', end_time: '17:00' })
  const [savingAdd,    setSavingAdd]    = useState(false)
  const [addError,     setAddError]     = useState<string | null>(null)

  // "Días bloqueados" form (active = false)
  const [showBlkForm,  setShowBlkForm]  = useState(false)
  const [blkForm,      setBlkForm]      = useState({ date_from: '', date_to: '' })
  const [savingBlk,    setSavingBlk]    = useState(false)
  const [blkError,     setBlkError]     = useState<string | null>(null)

  const supabase = createClient()

  // ── Load doctors + locations ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [{ data: dData }, { data: lData }] = await Promise.all([
        supabase.from('doctors').select('id, metadata').eq('organization_id', orgId).order('created_at', { ascending: true }),
        supabase.from('locations').select('id, name').eq('organization_id', orgId).order('name', { ascending: true }),
      ])
      setDoctors(dData ?? [])
      setLocations(lData ?? [])
      if (dData?.length) setDoctorId(dData[0].id)
      if (lData?.length) setLocationId(lData[0].id)
      setLoadingMeta(false)
    }
    load()
  }, [])

  // ── Load schedule when doctor changes ─────────────────────────────────────
  useEffect(() => {
    if (!doctorId) return
    const load = async () => {
      setLoadingSched(true)
      const fresh = emptyWeek()

      const { data: recurring } = await supabase
        .from('schedules')
        .select('day_of_week, start_time, end_time, location_id')
        .eq('doctor_id', doctorId)
        .eq('is_recurring', true)
        .order('start_time', { ascending: true })

      if (recurring?.length) {
        const firstLoc = recurring.find((r: any) => r.location_id)?.location_id
        if (firstLoc) setLocationId(firstLoc)

        // Group multiple rows per day into blocks
        const grouped: Record<number, TimeBlock[]> = {}
        recurring.forEach((row: any) => {
          if (fresh[row.day_of_week] !== undefined) {
            if (!grouped[row.day_of_week]) grouped[row.day_of_week] = []
            grouped[row.day_of_week].push({
              start_time: row.start_time ?? '08:00',
              end_time:   row.end_time   ?? '17:00',
            })
          }
        })

        Object.entries(grouped).forEach(([day, blocks]) => {
          fresh[Number(day)] = { enabled: true, blocks }
        })
      }
      setWeek(fresh)

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

  // ── Weekly handlers ───────────────────────────────────────────────────────
  const toggle = (day: number) =>
    setWeek(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        // If enabling with empty blocks, restore default
        blocks: !prev[day].enabled && prev[day].blocks.length === 0
          ? [{ start_time: '08:00', end_time: '17:00' }]
          : prev[day].blocks,
      },
    }))

  const setBlockTime = (day: number, idx: number, field: 'start_time' | 'end_time', val: string) =>
    setWeek(prev => {
      const blocks = prev[day].blocks.map((b, i) => i === idx ? { ...b, [field]: val } : b)
      return { ...prev, [day]: { ...prev[day], blocks } }
    })

  const addBlock = (day: number) =>
    setWeek(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        blocks: [...prev[day].blocks, { start_time: '08:00', end_time: '17:00' }],
      },
    }))

  const removeBlock = (day: number, idx: number) =>
    setWeek(prev => {
      const blocks = prev[day].blocks.filter((_, i) => i !== idx)
      return {
        ...prev,
        [day]: {
          enabled: blocks.length > 0 ? prev[day].enabled : false,
          blocks:  blocks.length > 0 ? blocks : [{ start_time: '08:00', end_time: '17:00' }],
        },
      }
    })

  const handleSaveWeek = async () => {
    if (!doctorId) { setWeekError('Selecciona un médico.'); return }
    setSaving(true)
    setWeekError(null)

    const { error: delErr } = await supabase
      .from('schedules').delete()
      .eq('doctor_id', doctorId).eq('is_recurring', true)
    if (delErr) { setWeekError(delErr.message); setSaving(false); return }

    // One row per block per enabled day
    const rows = DAYS.filter(d => week[d.value].enabled).flatMap(d =>
      week[d.value].blocks.map(block => ({
        doctor_id:    doctorId,
        location_id:  locationId || null,
        day_of_week:  d.value,
        start_time:   block.start_time,
        end_time:     block.end_time,
        active:       true,
        is_recurring: true,
      }))
    )

    if (rows.length) {
      const { error: insErr } = await supabase.from('schedules').insert(rows)
      if (insErr) { setWeekError(insErr.message); setSaving(false); return }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // ── Shared exception helpers ───────────────────────────────────────────────
  const refreshExceptions = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('id, specific_date, start_time, end_time, active')
      .eq('doctor_id', doctorId)
      .eq('is_recurring', false)
      .order('specific_date', { ascending: true })
    setExceptions((data as ExRow[]) ?? [])
  }

  const handleDelete = async (id: string) => {
    await supabase.from('schedules').delete().eq('id', id)
    setExceptions(prev => prev.filter(e => e.id !== id))
  }

  // ── Add extra day (active = true) ─────────────────────────────────────────
  const handleAddExtraDay = async () => {
    if (!addForm.date_from) { setAddError('Selecciona una fecha.'); return }
    setSavingAdd(true)
    setAddError(null)

    const dates = expandDateRange(addForm.date_from, addForm.date_to || null)
    const rows = dates.map(d => ({
      doctor_id:     doctorId,
      location_id:   locationId || null,
      specific_date: d,
      day_of_week:   null,
      start_time:    addForm.start_time,
      end_time:      addForm.end_time,
      active:        true,
      is_recurring:  false,
    }))

    const { error } = await supabase.from('schedules').insert(rows as any)

    if (error) { setAddError(error.message); setSavingAdd(false); return }
    await refreshExceptions()
    setAddForm({ date_from: '', date_to: '', start_time: '08:00', end_time: '17:00' })
    setShowAddForm(false)
    setSavingAdd(false)
  }

  // ── Block day (active = false) ────────────────────────────────────────────
  const handleBlockDay = async () => {
    if (!blkForm.date_from) { setBlkError('Selecciona una fecha.'); return }
    setSavingBlk(true)
    setBlkError(null)

    const dates = expandDateRange(blkForm.date_from, blkForm.date_to || null)
    const rows = dates.map(d => ({
      doctor_id:     doctorId,
      location_id:   locationId || null,
      specific_date: d,
      day_of_week:   null,
      start_time:    null,
      end_time:      null,
      active:        false,
      is_recurring:  false,
    }))

    const { error } = await supabase.from('schedules').insert(rows as any)

    if (error) { setBlkError(error.message); setSavingBlk(false); return }
    await refreshExceptions()
    setBlkForm({ date_from: '', date_to: '' })
    setShowBlkForm(false)
    setSavingBlk(false)
  }

  // ── Derived lists ─────────────────────────────────────────────────────────
  const extraDays   = exceptions.filter(e => e.active)
  const blockedDays = exceptions.filter(e => !e.active)

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/* ── Horario semanal ───────────────────────────────────────────────────── */}
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
                  className="flex gap-4 border-b border-slate-100 px-6 py-3 last:border-0"
                >
                  {/* Toggle */}
                  <div className="flex items-start pt-1 shrink-0">
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
                  </div>

                  {/* Day label */}
                  <div className="flex items-start pt-1 shrink-0">
                    <span className={[
                      'w-24 text-sm font-medium',
                      day.enabled ? 'text-slate-900' : 'text-slate-400',
                    ].join(' ')}>
                      {label}
                    </span>
                  </div>

                  {/* Blocks or inactive */}
                  {day.enabled ? (
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      {day.blocks.map((block, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={block.start_time}
                            onChange={e => setBlockTime(value, idx, 'start_time', e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-400">—</span>
                          <input
                            type="time"
                            value={block.end_time}
                            onChange={e => setBlockTime(value, idx, 'end_time', e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {day.blocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBlock(value, idx)}
                              className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-400 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addBlock(value)}
                        className="self-start text-xs font-medium text-blue-500 hover:text-blue-700 transition"
                      >
                        + Agregar bloque
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="text-sm text-slate-400">Sin atención</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Save footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-sm">
            {weekError && <span className="text-red-600">{weekError}</span>}
            {saved && (
              <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                <Check className="h-4 w-4" /> Horario guardado
              </span>
            )}
          </span>
          <button
            onClick={handleSaveWeek}
            disabled={saving || loadingSched}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar horario
          </button>
        </div>
      </div>

      {/* ── Días adicionales ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Días adicionales</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Días fuera del horario normal donde sí atiende
            </p>
          </div>
          {!showAddForm && (
            <button
              onClick={() => { setShowAddForm(true); setAddError(null) }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar día adicional
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rango de fechas</label>
                <div className="mt-1.5">
                  <DateRangePicker
                    value={{ from: addForm.date_from, to: addForm.date_to }}
                    onChange={(range) => setAddForm(p => ({ ...p, date_from: range.from, date_to: range.to }))}
                    placeholder="Seleccionar fecha o rango"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horario</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="time"
                    value={addForm.start_time}
                    onChange={e => setAddForm(p => ({ ...p, start_time: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-400">—</span>
                  <input
                    type="time"
                    value={addForm.end_time}
                    onChange={e => setAddForm(p => ({ ...p, end_time: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAddExtraDay}
                disabled={savingAdd}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {savingAdd && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddForm({ date_from: '', date_to: '', start_time: '08:00', end_time: '17:00' }); setAddError(null) }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {extraDays.length === 0 && !showAddForm ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">Sin días adicionales.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {extraDays.map(ex => (
              <div key={ex.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium capitalize text-slate-900">{fmtDate(ex.specific_date)}</p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-600">
                    {ex.start_time?.slice(0, 5)} — {ex.end_time?.slice(0, 5)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(ex.id)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Días bloqueados ───────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Días bloqueados</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Días sin atención (festivos, vacaciones)
            </p>
          </div>
          {!showBlkForm && (
            <button
              onClick={() => { setShowBlkForm(true); setBlkError(null) }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Bloquear día
            </button>
          )}
        </div>

        {showBlkForm && (
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5 space-y-4">
            <div className="max-w-md">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rango de fechas</label>
              <div className="mt-1.5">
                <DateRangePicker
                  value={{ from: blkForm.date_from, to: blkForm.date_to }}
                  onChange={(range) => setBlkForm(p => ({ ...p, date_from: range.from, date_to: range.to }))}
                  placeholder="Seleccionar fecha o rango"
                />
              </div>
            </div>
            {blkError && <p className="text-sm text-red-600">{blkError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleBlockDay}
                disabled={savingBlk}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {savingBlk && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Bloquear
              </button>
              <button
                onClick={() => { setShowBlkForm(false); setBlkForm({ date_from: '', date_to: '' }); setBlkError(null) }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {blockedDays.length === 0 && !showBlkForm ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">Sin días bloqueados.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {blockedDays.map(ex => (
              <div key={ex.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100">
                    <Lock className="h-3.5 w-3.5 text-rose-500" />
                  </span>
                  <p className="text-sm font-medium capitalize text-slate-900">{fmtDate(ex.specific_date)}</p>
                </div>
                <button
                  onClick={() => handleDelete(ex.id)}
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
