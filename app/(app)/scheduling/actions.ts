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
