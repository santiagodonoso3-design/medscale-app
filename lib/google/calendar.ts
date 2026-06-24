import { logAppointmentEvent } from '@/lib/appointments/log-event'

interface CalendarEventParams {
  doctorId: string
  summary: string
  description: string
  startIso: string
  endsIso: string
  attendeeEmail?: string | null
  appointmentId?: string
}

interface RefreshResult {
  accessToken: string
  expiresInSec: number
}

async function refreshAccessToken(token: any): Promise<RefreshResult> {
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
  if (!res.ok || !data.access_token) {
    throw new Error(`refresh_failed: ${res.status} ${data.error ?? 'unknown'}`)
  }
  return {
    accessToken:  data.access_token,
    expiresInSec: data.expires_in ?? 3600,
  }
}

async function getValidAccessToken(
  token: any,
  doctorId: string,
  admin: any,
): Promise<string> {
  if (Date.now() > token.expiry_date - 60000) {
    const { accessToken, expiresInSec } = await refreshAccessToken(token)
    await admin.from('doctors').update({
      google_calendar_token: {
        ...token,
        access_token: accessToken,
        expiry_date:  Date.now() + expiresInSec * 1000,
      },
    }).eq('id', doctorId)
    return accessToken
  }
  return token.access_token as string
}

export async function createGoogleCalendarEvent(
  params: CalendarEventParams
): Promise<string | null> {
  let calendarId = 'primary'
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const admin = createServiceClient()

    const { data: doctor } = await admin
      .from('doctors')
      .select('google_calendar_token, google_calendar_id')
      .eq('id', params.doctorId)
      .single()

    console.log('[google/calendar] doctor token exists:', !!doctor?.google_calendar_token)

    if (!doctor?.google_calendar_token) {
      console.log('[google/calendar] no token found for doctor:', params.doctorId)
      if (params.appointmentId) {
        await logAppointmentEvent({
          appointmentId: params.appointmentId,
          eventType:     'calendar_failed',
          actorType:     'system',
          note:          'Doctor no tiene Google Calendar conectado',
          metadata:      { reason: 'no_token', calendar_id: null },
        })
      }
      return null
    }

    const token = doctor.google_calendar_token as any
    calendarId = doctor.google_calendar_id ?? 'primary'
    const accessToken = await getValidAccessToken(token, params.doctorId, admin)

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
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method:  'POST',
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
    if (params.appointmentId) {
      await logAppointmentEvent({
        appointmentId: params.appointmentId,
        eventType:     'calendar_failed',
        actorType:     'system',
        note:          'Google Calendar API rechazó la creación del evento',
        metadata:      {
          reason:       'api_rejected',
          http_status:  res.status,
          google_error: data.error?.message ?? data.error ?? null,
          calendar_id:  calendarId,
        },
      })
    }
    return null
  } catch (e: any) {
    console.error('[google/calendar] fatal error:', e)
    if (params.appointmentId) {
      await logAppointmentEvent({
        appointmentId: params.appointmentId,
        eventType:     'calendar_failed',
        actorType:     'system',
        note:          'Excepción al crear evento en Google Calendar',
        metadata:      {
          reason:      e?.message ?? 'unknown_exception',
          calendar_id: calendarId,
        },
      }).catch(() => {})
    }
    return null
  }
}

export async function getGoogleCalendarBusy(
  doctorId: string,
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[]> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const admin = createServiceClient()

    const { data: doctor } = await admin
      .from('doctors')
      .select('google_calendar_token, google_calendar_id')
      .eq('id', doctorId)
      .single()

    if (!doctor?.google_calendar_token) return []

    const token = doctor.google_calendar_token as any
    const accessToken = await getValidAccessToken(token, doctorId, admin)
    const calendarId = doctor.google_calendar_id ?? 'primary'

    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: 'America/Bogota',
        items:    [{ id: calendarId }],
      }),
    })

    const data = await res.json()
    const busy: { start: string; end: string }[] = data?.calendars?.[calendarId]?.busy ?? []
    return busy
  } catch (e) {
    console.error('[google/calendar] freeBusy error:', e)
    return []
  }
}

export async function deleteGoogleCalendarEvent(
  doctorId: string,
  eventId: string
): Promise<void> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const admin = createServiceClient()

    const { data: doctor } = await admin
      .from('doctors')
      .select('google_calendar_token, google_calendar_id')
      .eq('id', doctorId)
      .single()

    if (!doctor?.google_calendar_token) return

    const token = doctor.google_calendar_token as any
    const accessToken = await getValidAccessToken(token, doctorId, admin)
    const calendarId = doctor.google_calendar_id ?? 'primary'

    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
  } catch (e) {
    console.error('[google/calendar] delete error:', e)
  }
}

export async function updateGoogleCalendarEvent(
  doctorId: string,
  eventId: string,
  startIso: string,
  endsIso: string
): Promise<boolean> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const admin = createServiceClient()

    const { data: doctor } = await admin
      .from('doctors')
      .select('google_calendar_token, google_calendar_id')
      .eq('id', doctorId)
      .single()

    if (!doctor?.google_calendar_token) return false

    const token = doctor.google_calendar_token as any
    const accessToken = await getValidAccessToken(token, doctorId, admin)
    const calendarId = doctor.google_calendar_id ?? 'primary'

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: { dateTime: startIso, timeZone: 'America/Bogota' },
          end:   { dateTime: endsIso,  timeZone: 'America/Bogota' },
        }),
      }
    )

    return res.ok
  } catch (e) {
    console.error('[google/calendar] update error:', e)
    return false
  }
}
