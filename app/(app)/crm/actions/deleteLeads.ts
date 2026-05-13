'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrgIdFromUser } from '@/lib/get-org-id'

export async function deleteLeads(ids: string[]): Promise<{ error?: string }> {
  if (!ids.length) return {}

  // Resolve org from session — never trust a client-supplied org ID for deletes
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const orgId = await getOrgIdFromUser(user.id)
  if (!orgId) return { error: 'Organización no encontrada' }

  const admin = createServiceClient()
  const { error } = await admin
    .from('leads')
    .delete()
    .in('id', ids)
    .eq('organization_id', orgId)  // hard org fence

  return error ? { error: error.message } : {}
}
