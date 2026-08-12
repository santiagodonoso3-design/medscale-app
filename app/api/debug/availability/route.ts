import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getGoogleCalendarBusy } from '@/lib/google/calendar'
import { fetchScheduleRowsForDate, resolveBlocksForDate } from '@/lib/availability/resolve'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const doctorId = req.nextUrl.searchParams.get('doctor_id')
  const date = req.nextUrl.searchParams.get('date')
  if (!doctorId || !date) {
    return NextResponse.json({ error: 'faltan doctor_id o date (YYYY-MM-DD)' }, { status: 400 })
  }

  const admin = createServiceClient()

  const { data: doctor } = await admin
    .from('doctors')
    .select('metadata, google_calendar_id, google_calendar_token, google_calendar_connected_at')
    .eq('id', doctorId)
    .single()

  const token = (doctor?.google_calendar_token ?? null) as any
  const expiryDate = token?.expiry_date ? new Date(Number(token.expiry_date)).toISOString() : null

  const scheduleRows = await fetchScheduleRowsForDate(admin as any, [doctorId], date)
  const blocks = resolveBlocksForDate(scheduleRows as any, doctorId, date)

  const dayStart = new Date(`${date}T00:00:00-05:00`).toISOString()
  const dayEnd = new Date(`${date}T23:59:59-05:00`).toISOString()
  const monthStart = new Date(`${date.slice(0, 8)}01T00:00:00-05:00`).toISOString()
  const monthEnd = new Date(new Date(`${date.slice(0, 8)}01T00:00:00-05:00`).setMonth(new Date(`${date.slice(0, 8)}01T00:00:00-05:00`).getMonth() + 1)).toISOString()

  const busyDay = await getGoogleCalendarBusy(doctorId, dayStart, dayEnd)
  const busyMonth = await getGoogleCalendarBusy(doctorId, monthStart, monthEnd)

  const { data: appts } = await admin
    .from('appointments')
    .select('scheduled_at, ends_at, status')
    .eq('doctor_id', doctorId)
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd)

  return NextResponse.json({
    medico: doctor?.metadata ?? null,
    google: {
      calendar_id: doctor?.google_calendar_id ?? null,
      conectado_desde: doctor?.google_calendar_connected_at ?? null,
      token_expira: expiryDate,
      tiene_refresh_token: Boolean(token?.refresh_token),
    },
    rango_consultado: { dayStart, dayEnd, monthStart, monthEnd },
    schedules_crudos: scheduleRows,
    bloques_resueltos: blocks,
    google_busy_dia: busyDay,
    google_busy_mes_completo: busyMonth,
    citas_db_ese_dia: appts ?? [],
  }, { status: 200 })
}
