import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function getSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createServiceClient()

  // Check impersonation
  const cookieStore = await cookies()
  const impersonateOrgId = cookieStore.get('impersonate_org_id')?.value

  if (impersonateOrgId) {
    const { data: platformAdmin } = await admin
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (platformAdmin) {
      return {
        user,
        orgId: impersonateOrgId,
        role: 'owner' as const,
        doctorId: null,
        isImpersonating: true,
      }
    }
  }

  // Normal flow
  const { data: member } = await admin
    .from('organization_members')
    .select('organization_id, role, doctor_id, permissions')
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  return {
    user,
    orgId: member.organization_id as string,
    role: member.role as 'owner' | 'staff' | 'doctor',
    doctorId: (member.doctor_id as string) ?? null,
    permissions: (member.permissions ?? null) as Record<string, string> | null,
    isImpersonating: false,
  }
}
