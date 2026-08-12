import type { SupabaseClient } from '@supabase/supabase-js'

export type ScheduleRow = {
  doctor_id: string
  day_of_week: number | null
  start_time: string | null
  end_time: string | null
  is_recurring: boolean
  active: boolean
  specific_date: string | null
}

export type Block = { start: string; end: string }

/** day_of_week en DB: 0=Dom … 6=Sáb, igual que JS getDay(). */
export function dayOfWeekFor(date: string): number {
  return new Date(`${date}T12:00:00`).getDay()
}

/**
 * Resuelve los bloques efectivos de atención de un médico en una fecha.
 * Precedencia:
 *  1. Un día bloqueado (is_recurring=false, active=false, specific_date=fecha) gana
 *     sobre todo: devuelve [] aunque existan reglas recurrentes o días adicionales.
 *  2. Los días adicionales (is_recurring=false, active=true) SUMAN a las reglas
 *     recurrentes del mismo día de semana; no las reemplazan.
 */
export function resolveBlocksForDate(rows: ScheduleRow[], doctorId: string, date: string): Block[] {
  const dow = dayOfWeekFor(date)
  const mine = rows.filter(r => r.doctor_id === doctorId)

  const exceptions = mine.filter(r => r.is_recurring === false && r.specific_date === date)
  if (exceptions.some(r => r.active === false)) return []

  const recurring = mine.filter(
    r => r.is_recurring === true && r.active === true && r.day_of_week === dow
  )
  const additional = exceptions.filter(r => r.active === true)

  return [...recurring, ...additional]
    .filter(r => r.start_time != null && r.end_time != null)
    .map(r => ({ start: r.start_time as string, end: r.end_time as string }))
}

/** true si `time` (HH:mm) cabe en algún bloque. durationMin=0 preserva la semántica actual. */
export function isTimeWithinBlocks(blocks: Block[], time: string, durationMin = 0): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const startMin = toMin(time)
  const endMin = startMin + durationMin
  return blocks.some(b => toMin(b.start) <= startMin && endMin <= toMin(b.end) && (durationMin > 0 || startMin < toMin(b.end)))
}

/** Trae las filas de schedules relevantes para una fecha. NO filtra por `active`: las filas de bloqueo tienen active=false y deben viajar para poder negarlas. */
export async function fetchScheduleRowsForDate(
  supabase: SupabaseClient<any, any, any>,
  doctorIds: string[],
  date: string
): Promise<ScheduleRow[]> {
  const dow = dayOfWeekFor(date)
  const { data, error } = await supabase
    .from('schedules')
    .select('doctor_id, day_of_week, start_time, end_time, is_recurring, active, specific_date')
    .in('doctor_id', doctorIds)
    .or(`and(is_recurring.eq.true,day_of_week.eq.${dow}),specific_date.eq.${date}`)
  if (error) { console.error('[availability] schedules fetch error:', error); return [] }
  return (data ?? []) as ScheduleRow[]
}
