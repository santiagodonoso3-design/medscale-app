'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function deleteLeads(ids: string[]): Promise<{ error?: string }> {
  if (!ids.length) return {}

  // Resolve org from session — never trust a client-supplied org ID for deletes
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return { error: 'Organización no encontrada' }

  const admin = await createServiceClient()
  const { error } = await admin
    .from('leads')
    .delete()
    .in('id', ids)
    .eq('organization_id', profile.organization_id)  // hard org fence

  return error ? { error: error.message } : {}
}
