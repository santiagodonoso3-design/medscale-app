'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
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

export async function updateAppointmentStatus(
  id: string,
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'confirmed'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { error: 'Organización no encontrada' }
  const admin = await createServiceClient()
  const { error } = await admin
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
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
