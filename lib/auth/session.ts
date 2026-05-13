import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function getSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createServiceClient()
  const { data: member } = await admin
    .from('organization_members')
    .select('organization_id, role, doctor_id')
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  return {
    user,
    orgId: member.organization_id as string,
    role: member.role as 'owner' | 'staff' | 'doctor',
    doctorId: (member.doctor_id as string) ?? null,
  }
}
