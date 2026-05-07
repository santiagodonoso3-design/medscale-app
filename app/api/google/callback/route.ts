import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code  = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') // doctor_id
  const error = request.nextUrl.searchParams.get('error')

  if (error || !code || !state) {
    return Response.redirect('https://app.medscale.app/doctors?google_error=true')
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
      return Response.redirect('https://app.medscale.app/doctors?google_error=true')
    }

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const calData = await calRes.json()
    const calendarId = calData.id ?? 'primary'

    const admin = await createServiceClient()
    await admin.from('doctors').update({
      google_calendar_token: {
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date:   Date.now() + (tokens.expires_in * 1000),
      },
      google_calendar_id:           calendarId,
      google_calendar_connected_at: new Date().toISOString(),
    }).eq('id', state)

    return Response.redirect('https://app.medscale.app/doctors?google_success=true')
  } catch (e) {
    console.error('[google/callback] error:', e)
    return Response.redirect('https://app.medscale.app/doctors?google_error=true')
  }
}
