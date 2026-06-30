// TEMPORARY diagnostic endpoint — token health probe for Google Calendar.
// Purpose: tell whether each doctor's Google token is alive by making a real
// freeBusy call. Replicates the calendar lib's refresh + freeBusy logic WITHOUT
// the fail-open catch, so a dead token surfaces as 'dead' instead of 'alive []'.
// DELETE once the diagnosis is done. Do not rely on this in production flows.
import { createServiceClient } from '@/lib/supabase/server'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Replica de refreshAccessToken (lib/google/calendar.ts) — lanza si falla.
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
  if (!res.ok || !data.access_token) {
    throw new Error(`refresh_failed: ${res.status} ${data.error ?? 'unknown'}`)
  }
  return data.access_token as string
}

// Replica de getValidAccessToken — refresca si está por expirar, lanza si falla.
async function getValidAccessToken(token: any, doctorId: string, admin: any): Promise<string> {
  if (Date.now() > token.expiry_date - 60000) {
    const accessToken = await refreshAccessToken(token)
    await admin.from('doctors').update({
      google_calendar_token: {
        ...token,
        access_token: accessToken,
        expiry_date:  Date.now() + 3600 * 1000,
      },
    }).eq('id', doctorId)
    return accessToken
  }
  return token.access_token as string
}

// freeBusy directo SIN fail-open: lanza ante token muerto / error de Google.
async function probeFreeBusy(
  doctorId: string,
  timeMin: string,
  timeMax: string,
  admin: any
): Promise<{ start: string; end: string }[]> {
  const { data: doctor } = await admin
    .from('doctors')
    .select('google_calendar_token, google_calendar_id')
    .eq('id', doctorId)
    .single()

  if (!doctor?.google_calendar_token) {
    throw new Error('no_token: doctor sin Google Calendar conectado')
  }

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
  if (!res.ok) {
    throw new Error(`freebusy_http_${res.status}: ${data?.error?.message ?? data?.error ?? 'unknown'}`)
  }
  const cal = data?.calendars?.[calendarId]
  if (cal?.errors && cal.errors.length > 0) {
    throw new Error(`freebusy_calendar_error: ${JSON.stringify(cal.errors)}`)
  }
  return (cal?.busy ?? []) as { start: string; end: string }[]
}

export async function GET(request: Request) {
  if (request.headers.get('x-debug-secret') !== process.env.WEBHOOK_SECRET) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401)
  }

  const orgId = new URL(request.url).searchParams.get('org')
  if (!orgId) {
    return jsonResponse({ success: false, error: 'Falta query param ?org=' }, 400)
  }

  const admin = createServiceClient()

  const { data: doctors, error: docError } = await admin
    .from('doctors')
    .select('id, metadata')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (docError) {
    return jsonResponse({ success: false, error: docError.message }, 500)
  }

  const now      = new Date()
  const timeMin  = now.toISOString()
  const timeMax  = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

  const results = await Promise.all(
    (doctors ?? []).map(async (d: any) => {
      const name = (d.metadata as any)?.name ?? null
      try {
        const busy = await probeFreeBusy(d.id, timeMin, timeMax, admin)
        return {
          doctor_id: d.id,
          name,
          status: 'alive' as const,
          detail: `busy slots: ${busy.length}`,
        }
      } catch (e: any) {
        const message = e?.message ?? String(e)
        const status: 'dead' | 'error' =
          message.startsWith('no_token') || message.startsWith('refresh_failed') ? 'dead' : 'error'
        return {
          doctor_id: d.id,
          name,
          status,
          detail: message,
        }
      }
    })
  )

  return jsonResponse({ success: true, org: orgId, count: results.length, results })
}
