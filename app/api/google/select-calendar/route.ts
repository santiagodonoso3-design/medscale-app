import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { doctor_id, calendar_id } = await request.json()

    if (!doctor_id || !calendar_id) {
      return Response.json({ error: 'Missing doctor_id or calendar_id' }, { status: 400 })
    }

    const admin = createServiceClient()

    // Fetch existing metadata to strip out the temporary google_calendars list
    const { data: doctorData } = await admin
      .from('doctors')
      .select('metadata')
      .eq('id', doctor_id)
      .single()

    const existingMetadata: Record<string, unknown> = { ...(doctorData?.metadata ?? {}) }
    delete existingMetadata['google_calendars']

    await admin.from('doctors').update({
      google_calendar_id:           calendar_id,
      google_calendar_connected_at: new Date().toISOString(),
      metadata:                     existingMetadata,
    }).eq('id', doctor_id)

    return Response.json({ ok: true })
  } catch (e) {
    console.error('[google/select-calendar] error:', e)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
