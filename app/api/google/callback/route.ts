import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/config/urls'

export async function GET(request: NextRequest) {
  const code  = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') // doctor_id
  const error = request.nextUrl.searchParams.get('error')

  if (error || !code || !state) {
    return Response.redirect(`${getAppUrl(request)}/settings/integrations?google_error=true`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
        grant_type:    'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokens.access_token) {
      console.error('[google/callback] token exchange failed:', tokens)
      return Response.redirect(`${getAppUrl(request)}/settings/integrations?google_error=true`)
    }

    // List all calendars the user has write access to
    const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const listData = await listRes.json()
    const calendars: { id: string; summary: string }[] = (listData.items ?? [])
      .filter((c: any) => c.accessRole === 'owner' || c.accessRole === 'writer')
      .map((c: any) => ({ id: c.id as string, summary: c.summary as string }))

    const tokenPayload = {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date:   Date.now() + (tokens.expires_in * 1000),
    }

    const admin = createServiceClient()

    if (calendars.length <= 1) {
      // Single calendar — connect directly, no selection needed
      const calendarId = calendars[0]?.id ?? 'primary'
      await admin.from('doctors').update({
        google_calendar_token:        tokenPayload,
        google_calendar_id:           calendarId,
        google_calendar_connected_at: new Date().toISOString(),
      }).eq('id', state)

      return Response.redirect(`${getAppUrl(request)}/settings/integrations?google_success=true`)
    }

    // Multiple calendars — store token + list temporarily, let doctor pick
    const { data: doctorData } = await admin
      .from('doctors')
      .select('metadata')
      .eq('id', state)
      .single()

    const existingMetadata = (doctorData?.metadata as Record<string, unknown>) ?? {}

    await admin.from('doctors').update({
      google_calendar_token: tokenPayload,
      google_calendar_id:    null,           // not set until doctor picks
      metadata:              { ...existingMetadata, google_calendars: calendars },
    }).eq('id', state)

    return Response.redirect(
      `${getAppUrl(request)}/settings/integrations?google_select_calendar=${state}`
    )
  } catch (e) {
    console.error('[google/callback] error:', e)
    return Response.redirect(`${getAppUrl(request)}/settings/integrations?google_error=true`)
  }
}
