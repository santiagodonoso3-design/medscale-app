import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { requirePlatformAdminScope } from '@/lib/auth/session'
import { AdminLayout } from '@/components/admin/layout'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  let scope = null
  try {
    scope = await requirePlatformAdminScope()
  } catch {
    scope = null
  }
  if (!scope) redirect('/dashboard')

  const admin = createServiceClient()
  let orgsQuery = admin
    .from('organizations')
    .select('id, name, logo_url')
    .eq('is_active', true)
  if (scope.orgIds !== null) orgsQuery = orgsQuery.in('id', scope.orgIds)
  const { data: orgs } = await orgsQuery.order('name')

  return <AdminLayout allOrganizations={orgs || []}>{children}</AdminLayout>
}
