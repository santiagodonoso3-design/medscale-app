'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { TeamClient } from './team-client'

export default async function TeamPage() {
  const supabase = await createClient()
  const admin = createServiceClient()

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

  const doctorMemberIds = (members ?? [])
    .filter(m => m.doctor_id)
    .map(m => m.doctor_id)

  const { data: schedulesData } = doctorMemberIds.length
    ? await admin
        .from('schedules')
        .select('doctor_id')
        .eq('is_recurring', true)
        .in('doctor_id', doctorMemberIds)
    : { data: [] }

  const doctorsWithSchedules = [...new Set(
    (schedulesData ?? []).map((s: any) => s.doctor_id)
  )] as string[]

  return (
    <div className="p-6 xl:p-10">
    <TeamClient
      orgId={profile.organization_id}
      members={(members ?? []).map(m => ({
        ...m,
        email: memberEmails[m.user_id] ?? '—',
      }))}
      doctors={doctors ?? []}
      currentUserId={user.id}
      doctorsWithSchedules={doctorsWithSchedules}
    />
    </div>
  )
}
