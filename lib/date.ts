// ─────────────────────────────────────────────────────────────────────────────
// Fuente única de verdad para fechas en Bogotá (UTC-5, sin DST).
// NO usar .slice(0,10) sobre timestamps ni new Date(fecha) sin offset.
// Usar estos helpers.
//
// Consolida los patrones YA probados en producción:
//   - app/(app)/dashboard/actions.ts (toBogotaYM, currentBogotaYear)
//   - app/actions/booking.ts (toBogota)
// Enfoque: Intl.DateTimeFormat con timeZone 'America/Bogota' para leer, y el
// offset explícito -05:00 para construir un instante desde fecha+hora locales.
//
// Ejemplos verificados:
//   buildBogotaISO('2026-07-15', '20:00') === '2026-07-16T01:00:00.000Z'
//   bogotaDayStr('2026-07-16T01:00:00.000Z') === '2026-07-15'
//   bogotaMonthStr('2026-07-16T01:00:00.000Z') === '2026-07'
//   bogotaTimeStr('2026-07-16T01:00:00.000Z') === '20:00'
// ─────────────────────────────────────────────────────────────────────────────

const BOGOTA_TZ = 'America/Bogota'

/**
 * Construye el ISO UTC correcto a partir de fecha ('YYYY-MM-DD') y hora ('HH:mm')
 * LOCALES de Bogotá. Reemplaza la operación hoy copiada en /api/book, crm-modal,
 * calendar-client y la ruta de manage.
 */
export function buildBogotaISO(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00-05:00`).toISOString()
}

/**
 * 'YYYY-MM-DD' del día EN BOGOTÁ a partir de un ISO (UTC).
 * Reemplazo correcto de los .slice(0,10) sobre scheduled_at (que dan el día
 * equivocado para citas nocturnas).
 */
export function bogotaDayStr(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TZ }).format(new Date(iso))
}

/** 'HH:mm' (24h) en Bogotá a partir de un ISO (UTC). */
export function bogotaTimeStr(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BOGOTA_TZ,
  })
    .format(new Date(iso))
    .replace(/^24:/, '00:') // algunos entornos emiten '24:00' para medianoche
}

/** 'YYYY-MM' en Bogotá (equivalente a toBogotaYM de dashboard/actions.ts). */
export function bogotaMonthStr(iso: string): string {
  return bogotaDayStr(iso).slice(0, 7)
}

/** 'YYYY-MM-DD' de HOY en Bogotá. */
export function todayBogotaStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TZ }).format(new Date())
}

/**
 * Día de la semana (0=Dom..6=Sáb, igual que JS) del día EN BOGOTÁ.
 * Se ancla a la fecha de Bogotá, NO a getDay() de un Date UTC — que puede caer
 * en otro día para instantes nocturnos. Construye la fecha pura al mediodía Z
 * para que el offset nunca cruce el límite del día.
 */
export function bogotaWeekday(iso: string): number {
  const dayStr = bogotaDayStr(iso)
  return new Date(`${dayStr}T12:00:00Z`).getUTCDay()
}
