import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ConversationsPageClient } from '@/components/conversations/conversations-page-client'

export default async function ConversationsPage() {
  const supabase = await createClient()
  const admin = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user?.id)
    .single()
  const { data: org } = await admin
    .from('organizations')
    .select('ai_agent_enabled, name, contact_email')
    .eq('id', userRecord?.organization_id)
    .single()
  return (
    <ConversationsPageClient
      organizationId={userRecord?.organization_id ?? ''}
      aiAgentEnabled={org?.ai_agent_enabled ?? false}
      orgName={org?.name ?? ''}
      orgEmail={org?.contact_email ?? ''}
    />
  )
}
