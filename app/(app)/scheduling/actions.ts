'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function cancelAppointment(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/scheduling/calendar')
  return {}
}

export async function logCancellation(
  appointmentId: string,
  reason: string,
  userId: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('appointment_logs').insert({
    appointment_id: appointmentId,
    event_type: 'cancelled',
    note: reason,
    performed_by: userId ?? null,
  })
  if (error) return { error: error.message }
  return {}
}

export async function updateAppointmentNotes(
  id: string,
  notes: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ notes })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/scheduling/calendar')
  return {}
}

export async function rescheduleAppointment(
  id: string,
  scheduledAt: string,
  endsAt: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ scheduled_at: scheduledAt, ends_at: endsAt })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/scheduling/calendar')
  return {}
}
