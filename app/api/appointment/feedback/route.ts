import { createServiceClient } from '@/lib/supabase/server'
import { logAppointmentEvent } from '@/lib/appointments/log-event'

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request) {
  try {
    const { token, reason } = await request.json()
    if (!token || !reason?.trim()) return json({ error: 'Parámetros incompletos' }, 400)

    const admin = createServiceClient()

    // Fetch appointment by manage_token
    const { data: apt, error: fetchErr } = await admin
      .from('appointments')
      .select('id, metadata')
      .eq('manage_token', token)
      .single()

    if (fetchErr || !apt) return json({ error: 'Cita no encontrada' }, 404)

    // Merge cancellation_reason into existing metadata
    const existingMeta = (apt.metadata ?? {}) as Record<string, unknown>
    await admin.from('appointments').update({
      metadata: { ...existingMeta, cancellation_reason: reason.trim() },
    }).eq('id', apt.id)

    // Log the feedback
    await logAppointmentEvent({
      appointmentId: apt.id,
      eventType: 'feedback',
      actorType: 'patient',
      note: reason.trim(),
    })

    return json({ success: true })
  } catch (err) {
    console.error('[/api/appointment/feedback]', err)
    return json({ error: 'Error interno' }, 500)
  }
}
