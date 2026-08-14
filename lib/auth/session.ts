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
      .select('id, scope')
      .eq('user_id', user.id)
      .single()

    if (platformAdmin) {
      let allowed = platformAdmin.scope === 'global'

      if (!allowed) {
        const { data: assignment } = await admin
          .from('platform_admin_organizations')
          .select('id')
          .eq('platform_admin_id', platformAdmin.id)
          .eq('organization_id', impersonateOrgId)
          .maybeSingle()
        allowed = !!assignment
      }

      if (allowed) {
        return {
          user,
          orgId: impersonateOrgId,
          role: 'owner' as const,
          doctorId: null,
          isImpersonating: true,
        }
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

/**
 * Require an authenticated tenant context. Reuses getSession() (which already
 * handles superadmin impersonation via the impersonate_org_id cookie), so the
 * returned orgId respects an active impersonation. Throws if there is no valid
 * session or the user has no organization.
 */
export async function requireOrgContext(): Promise<{
  userId: string
  orgId: string
  role: 'owner' | 'staff' | 'doctor'
}> {
  const session = await getSession()
  if (!session || !session.orgId) throw new Error('UNAUTHORIZED')
  return { userId: session.user.id, orgId: session.orgId, role: session.role }
}

/**
 * Require the caller to be a platform admin. Uses the REAL Supabase auth session
 * (never the impersonate_org_id cookie) and verifies membership in the
 * platform_admins table with the service client. Throws FORBIDDEN otherwise.
 */
export async function requirePlatformAdmin(): Promise<{ userId: string; role: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('UNAUTHORIZED')

  const admin = createServiceClient()
  const { data: platformAdmin } = await admin
    .from('platform_admins')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  if (!platformAdmin) throw new Error('FORBIDDEN')
  return { userId: user.id, role: platformAdmin.role as string }
}

export type PlatformAdminScope = {
  userId: string
  adminId: string
  role: string
  scope: 'global' | 'assigned'
  orgIds: string[] | null
}

/**
 * Like requirePlatformAdmin() but resolves the admin's org scope.
 * orgIds === null means GLOBAL access; an empty array means assigned to
 * zero orgs (NOT global) — always filter with `if (orgIds !== null)`.
 */
export async function requirePlatformAdminScope(): Promise<PlatformAdminScope> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('UNAUTHORIZED')

  const admin = createServiceClient()
  const { data: pa } = await admin
    .from('platform_admins')
    .select('id, role, scope')
    .eq('user_id', user.id)
    .single()

  if (!pa) throw new Error('FORBIDDEN')

  if (pa.scope === 'global') {
    return { userId: user.id, adminId: pa.id, role: pa.role, scope: 'global', orgIds: null }
  }

  const { data: rows } = await admin
    .from('platform_admin_organizations')
    .select('organization_id')
    .eq('platform_admin_id', pa.id)

  return {
    userId: user.id,
    adminId: pa.id,
    role: pa.role,
    scope: 'assigned',
    orgIds: (rows ?? []).map(r => r.organization_id as string),
  }
}

export async function assertOrgAllowed(orgId: string): Promise<PlatformAdminScope> {
  const s = await requirePlatformAdminScope()
  if (s.orgIds !== null && !s.orgIds.includes(orgId)) throw new Error('FORBIDDEN')
  return s
}
