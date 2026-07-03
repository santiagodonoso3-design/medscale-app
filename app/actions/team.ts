'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/session'

const VALID_ROLES = ['owner', 'staff', 'doctor'] as const

/**
 * Change a team member's role. Owner-only. The target member must belong to the
 * caller's org, you cannot change your own role, and you cannot demote the last
 * remaining owner. All writes go through the service client fenced by
 * organization_id (the browser write policy on organization_members was removed).
 */
export async function updateMemberRole(memberId: string, newRole: string): Promise<void> {
  const { userId, orgId, role } = await requireOrgContext()
  if (role !== 'owner') throw new Error('FORBIDDEN')
  if (!VALID_ROLES.includes(newRole as (typeof VALID_ROLES)[number])) throw new Error('INVALID_ROLE')

  const admin = createServiceClient()

  const { data: member } = await admin
    .from('organization_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single()

  if (!member) throw new Error('FORBIDDEN')
  if (member.user_id === userId) throw new Error('FORBIDDEN')

  // Prevent demoting the last owner of the org
  if (member.role === 'owner' && newRole !== 'owner') {
    const { count } = await admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('role', 'owner')
    if ((count ?? 0) <= 1) throw new Error('LAST_OWNER')
  }

  const { error } = await admin
    .from('organization_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
}

/**
 * Remove a team member. Owner-only, target must belong to the caller's org, you
 * cannot remove yourself, and you cannot remove the last remaining owner.
 */
export async function removeMember(memberId: string): Promise<void> {
  const { userId, orgId, role } = await requireOrgContext()
  if (role !== 'owner') throw new Error('FORBIDDEN')

  const admin = createServiceClient()

  const { data: member } = await admin
    .from('organization_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single()

  if (!member) throw new Error('FORBIDDEN')
  if (member.user_id === userId) throw new Error('FORBIDDEN')

  if (member.role === 'owner') {
    const { count } = await admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('role', 'owner')
    if ((count ?? 0) <= 1) throw new Error('LAST_OWNER')
  }

  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
}

/**
 * Remove the organization_members row tied to a doctor, as part of the doctor
 * deletion flow (the doctors/schedules deletes still run via their own path).
 * The doctor must belong to the caller's org.
 */
export async function removeDoctorMembership(doctorId: string): Promise<void> {
  const { orgId } = await requireOrgContext()

  const admin = createServiceClient()

  const { data: doctor } = await admin
    .from('doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('organization_id', orgId)
    .single()

  if (!doctor) throw new Error('FORBIDDEN')

  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('doctor_id', doctorId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
}
