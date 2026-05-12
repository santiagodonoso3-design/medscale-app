import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ConversationsPageClient } from '@/components/conversations/conversations-page-client'

export default async function ConversationsPage() {
  const supabase = await createClient()
  const admin = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user?.id)
    .single()
  return <ConversationsPageClient organizationId={userRecord?.organization_id ?? ''} />
}
