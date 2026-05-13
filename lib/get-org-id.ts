import { createServiceClient } from '@/lib/supabase/server'

export async function getOrgIdFromUser(userId: string): Promise<string | null> {
  const admin = createServiceClient()
  const { data: member } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .single()
  return member?.organization_id ?? null
}
