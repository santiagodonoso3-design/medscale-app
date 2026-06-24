export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getGoogleCalendarBusy } from '@/lib/google/calendar'

export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get('doctorId') ?? ''

  const timeMin = '2026-07-17T00:00:00.000Z'
  const timeMax = '2026-07-17T23:59:59.000Z'

  const admin = createServiceClient()
  const { data: doctor } = await admin
    .from('doctors')
    .select('google_calendar_id, google_calendar_connected_at, google_calendar_token')
    .eq('id', doctorId)
    .single()

  const token = doctor?.google_calendar_token as any
  const expiryDate: number | null = token?.expiry_date ?? null

  const tokenStatus = {
    hasAccess:      Boolean(token?.access_token),
    hasRefresh:     Boolean(token?.refresh_token),
    expiryDate,
    expiryReadable: expiryDate ? new Date(expiryDate).toISOString() : null,
    isExpired:      expiryDate ? expiryDate < Date.now() : null,
  }

  let busyResult: { start: string; end: string }[] = []
  let error: string | null = null

  try {
    busyResult = await getGoogleCalendarBusy(doctorId, timeMin, timeMax)
  } catch (e: any) {
    error = e?.message ?? String(e)
  }

  return NextResponse.json(
    {
      doctorId,
      calendarId:   doctor?.google_calendar_id ?? null,
      connectedAt:  doctor?.google_calendar_connected_at ?? null,
      tokenStatus,
      busyResult,
      busyCount:    busyResult.length,
      error,
    },
    { status: 200 },
  )
}
