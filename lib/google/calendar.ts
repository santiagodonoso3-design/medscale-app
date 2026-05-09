import { createServiceClient } from '@/lib/supabase/server'

interface CalendarEventParams {
  doctorId: string
  summary: string
  description: string
  startIso: string
  endsIso: string
  attendeeEmail?: string | null
}

async function refreshAccessToken(token: any): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: token.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token
}

export async function createGoogleCalendarEvent(
  params: CalendarEventParams
): Promise<string | null> {
  try {
    const admin = await createServiceClient()

    const { data: doctor } = await admin
      .from('doctors')
      .select('google_calendar_token, google_calendar_id')
      .eq('id', params.doctorId)
      .single()

    if (!doctor?.google_calendar_token) return null

    const token = doctor.google_calendar_token as any
    let accessToken = token.access_token

    if (Date.now() > token.expiry_date - 60000) {
      accessToken = await refreshAccessToken(token)
      await admin.from('doctors').update({
        google_calendar_token: {
          ...token,
          access_token: accessToken,
          expiry_date:  Date.now() + 3600000,
        }
      }).eq('id', params.doctorId)
    }

    const calendarId = doctor.google_calendar_id ?? 'primary'
    console.log('[google/calendar] got token, calendarId:', calendarId)

    const event: any = {
      summary:     params.summary,
      description: params.description,
      start: { dateTime: params.startIso, timeZone: 'America/Bogota' },
      end:   { dateTime: params.endsIso,  timeZone: 'America/Bogota' },
    }

    if (params.attendeeEmail) {
      event.attendees = [{ email: params.attendeeEmail }]
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    console.log('[google/calendar] event response status:', res.status)
    const data = await res.json()
    console.log('[google/calendar] event response data:', JSON.stringify(data))
    if (data.id) {
      console.log('[google/calendar] event created:', data.id)
      return data.id
    }
    console.error('[google/calendar] create failed:', data)
    return null
  } catch (e) {
    console.error('[google/calendar] error:', e)
    return null
  }
}

export async function deleteGoogleCalendarEvent(
  doctorId: string,
  eventId: string
): Promise<void> {
  try {
    const admin = await createServiceClient()

    const { data: doctor } = await admin
      .from('doctors')
      .select('google_calendar_token, google_calendar_id')
      .eq('id', doctorId)
      .single()

    if (!doctor?.google_calendar_token) return

    const token = doctor.google_calendar_token as any
    let accessToken = token.access_token

    if (Date.now() > token.expiry_date - 60000) {
      accessToken = await refreshAccessToken(token)
    }

    const calendarId = doctor.google_calendar_id ?? 'primary'

    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
  } catch (e) {
    console.error('[google/calendar] delete error:', e)
  }
}
