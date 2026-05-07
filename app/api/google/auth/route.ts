import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const doctorId = request.nextUrl.searchParams.get('doctor_id')
  if (!doctorId) {
    return new Response('Missing doctor_id', { status: 400 })
  }

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt:      'consent',
    state:       doctorId,
  })

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
