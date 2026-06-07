import { createServiceClient } from '@/lib/supabase/server'

export type AppointmentEventType =
  | 'created'
  | 'rescheduled'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'feedback'
  | 'email_patient_sent'
  | 'email_clinic_sent'
  | 'email_doctor_sent'
  | 'email_failed'

export type ActorType = 'patient' | 'staff' | 'system'

interface LogEventParams {
  appointmentId: string
  eventType: AppointmentEventType
  actorType: ActorType
  performedBy?: string | null
  note?: string | null
  metadata?: Record<string, unknown> | null
}

export async function logAppointmentEvent(params: LogEventParams): Promise<void> {
  try {
    const admin = createServiceClient()
    const { error } = await admin.from('appointment_logs').insert({
      appointment_id: params.appointmentId,
      event_type:     params.eventType,
      actor_type:     params.actorType,
      performed_by:   params.actorType === 'staff' ? (params.performedBy ?? null) : null,
      note:           params.note ?? null,
      metadata:       params.metadata ?? null,
    })
    if (error) console.error('[logAppointmentEvent] insert failed:', error.message, params.eventType)
  } catch (err) {
    console.error('[logAppointmentEvent] unexpected:', err)
  }
}
