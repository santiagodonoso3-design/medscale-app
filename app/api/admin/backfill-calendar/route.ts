import { createServiceClient } from '@/lib/supabase/server'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { logAppointmentEvent } from '@/lib/appointments/log-event'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const body = await request.json().catch(() => ({})) as {
    appointmentId?: string
    organizationId?: string
  }

  const { appointmentId, organizationId } = body

  if (!appointmentId && !organizationId) {
    return jsonResponse({ error: 'Se requiere appointmentId o organizationId' }, 400)
  }

  const admin = createServiceClient()

  let query = admin
    .from('appointments')
    .select('id, scheduled_at, ends_at, doctor_id, modality, leads(contact_name, contact_last_name, contact_phone, contact_email)')
    .is('external_calendar_id', null)
    .gt('scheduled_at', new Date().toISOString())
    .neq('status', 'cancelled')
    .neq('status', 'no_show')

  if (appointmentId) {
    query = query.eq('id', appointmentId)
  } else {
    query = query.eq('organization_id', organizationId!)
  }

  const { data: rows, error: queryError } = await query

  if (queryError) {
    console.error('[backfill-calendar] query error:', queryError)
    return jsonResponse({ error: queryError.message }, 500)
  }

  // Filter to appointments whose doctor has a Google Calendar token
  const doctorIds = [...new Set(
    (rows ?? []).map((a: any) => a.doctor_id as string).filter(Boolean)
  )]

  const connectedDoctorIds = new Set<string>()
  if (doctorIds.length > 0) {
    const { data: doctors } = await admin
      .from('doctors')
      .select('id')
      .in('id', doctorIds)
      .not('google_calendar_token', 'is', null)
    ;(doctors ?? []).forEach((d: any) => connectedDoctorIds.add(d.id as string))
  }

  const eligible = (rows ?? []).filter((a: any) => connectedDoctorIds.has(a.doctor_id))

  const result = {
    procesadas: eligible.length,
    exito:      0,
    fallo:      0,
    detalles:   [] as { appointmentId: string; resultado: 'exito' | 'fallo' }[],
  }

  for (let i = 0; i < eligible.length; i++) {
    const appt          = eligible[i]
    const lead          = appt.leads as any
    const patientName   = (lead?.contact_name      as string) ?? ''
    const patientLast   = (lead?.contact_last_name as string) ?? ''
    const phone         = (lead?.contact_phone     as string) ?? ''
    const email         = (lead?.contact_email     as string | null) ?? null
    const modality      = (appt.modality           as string) ?? 'presencial'
    const endsIso: string = appt.ends_at
      ?? new Date(new Date(appt.scheduled_at as string).getTime() + 30 * 60000).toISOString()

    const eventId = await createGoogleCalendarEvent({
      doctorId:      appt.doctor_id as string,
      appointmentId: appt.id        as string,
      summary:       `Cita — ${patientName}${patientLast ? ' ' + patientLast : ''}`,
      description:   `Paciente: ${patientName}${patientLast ? ' ' + patientLast : ''}\nTeléfono: ${phone}\nModalidad: ${modality}`,
      startIso:      appt.scheduled_at as string,
      endsIso,
      attendeeEmail: email,
    })

    if (eventId) {
      await admin.from('appointments')
        .update({ external_calendar_id: eventId })
        .eq('id', appt.id)
      await logAppointmentEvent({
        appointmentId: appt.id as string,
        eventType:     'calendar_event_created',
        actorType:     'system',
        note:          'Evento agregado al Google Calendar del médico (backfill)',
        metadata:      { calendar_event_id: eventId, source: 'backfill' },
      })
      result.exito++
      result.detalles.push({ appointmentId: appt.id as string, resultado: 'exito' })
    } else {
      // createGoogleCalendarEvent ya logueó calendar_failed con el motivo real
      result.fallo++
      result.detalles.push({ appointmentId: appt.id as string, resultado: 'fallo' })
    }

    if (i < eligible.length - 1) await sleep(300)
  }

  return jsonResponse(result)
}
