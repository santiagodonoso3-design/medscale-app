import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getUserPermissions, canAccess } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/server'
import { ConversationsPageClient } from '@/components/conversations/conversations-page-client'

export default async function ConversationsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const perms = getUserPermissions(session.role, session.permissions)
  if (!canAccess(perms, 'conversations')) redirect('/dashboard')

  const admin = createServiceClient()
  const { data: org } = await admin
    .from('organizations')
    .select('ai_agent_enabled, name, contact_email')
    .eq('id', session.orgId)
    .single()

  return (
    <ConversationsPageClient
      organizationId={session.orgId}
      aiAgentEnabled={org?.ai_agent_enabled ?? false}
      orgName={org?.name ?? ''}
      orgEmail={org?.contact_email ?? ''}
    />
  )
}
