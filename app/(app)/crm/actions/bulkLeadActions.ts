'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrgIdFromUser } from '@/lib/get-org-id'

async function getOrgId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getOrgIdFromUser(user.id)
}

export async function bulkUpdateLeadStatus(
  ids: string[],
  status: string,
): Promise<{ error?: string }> {
  if (!ids.length) return {}
  const orgId = await getOrgId()
  if (!orgId) return { error: 'No autenticado' }
  const admin = createServiceClient()
  const { error } = await admin
    .from('leads')
    .update({ status })
    .in('id', ids)
    .eq('organization_id', orgId)
  return error ? { error: error.message } : {}
}

export async function bulkUpdateLeadSource(
  ids: string[],
  source: string,
): Promise<{ error?: string }> {
  if (!ids.length) return {}
  const orgId = await getOrgId()
  if (!orgId) return { error: 'No autenticado' }
  const admin = createServiceClient()
  const { error } = await admin
    .from('leads')
    .update({ source })
    .in('id', ids)
    .eq('organization_id', orgId)
  return error ? { error: error.message } : {}
}
