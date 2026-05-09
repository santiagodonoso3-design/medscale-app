'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { TeamClient } from './team-client'

export default async function TeamPage() {
  const supabase = await createClient()
  const admin = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return null

  const { data: members } = await admin
    .from('organization_members')
    .select('id, role, doctor_id, created_at, user_id')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: true })

  // Get emails from auth.users for each member
  const memberIds = (members ?? []).map(m => m.user_id)
  const memberEmails: Record<string, string> = {}

  for (const uid of memberIds) {
    const { data: authUser } = await admin.auth.admin.getUserById(uid)
    if (authUser?.user?.email) {
      memberEmails[uid] = authUser.user.email
    }
  }

  const { data: doctors } = await admin
    .from('doctors')
    .select('id, metadata')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)

  return (
    <TeamClient
      orgId={profile.organization_id}
      members={(members ?? []).map(m => ({
        ...m,
        email: memberEmails[m.user_id] ?? '—',
      }))}
      doctors={doctors ?? []}
      currentUserId={user.id}
    />
  )
}
