import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrgIdFromUser } from '@/lib/get-org-id'
import { ConversationsPageClient } from '@/components/conversations/conversations-page-client'

export default async function ConversationsPage() {
  const supabase = await createClient()
  const admin = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user ? await getOrgIdFromUser(user.id) : null
  const { data: org } = await admin
    .from('organizations')
    .select('ai_agent_enabled, name, contact_email')
    .eq('id', orgId)
    .single()
  return (
    <ConversationsPageClient
      organizationId={orgId ?? ''}
      aiAgentEnabled={org?.ai_agent_enabled ?? false}
      orgName={org?.name ?? ''}
      orgEmail={org?.contact_email ?? ''}
    />
  )
}
