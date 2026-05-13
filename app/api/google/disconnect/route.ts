import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { doctor_id } = await request.json()
    if (!doctor_id) return new Response('Missing doctor_id', { status: 400 })

    const admin = createServiceClient()
    await admin.from('doctors').update({
      google_calendar_token:        null,
      google_calendar_id:           null,
      google_calendar_connected_at: null,
    }).eq('id', doctor_id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ success: false }), { status: 500 })
  }
}
