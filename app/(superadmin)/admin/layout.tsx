import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { AdminLayout } from '@/components/admin/layout'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  let authorized = true
  try {
    await requirePlatformAdmin()
  } catch {
    authorized = false
  }
  if (!authorized) redirect('/dashboard')

  const admin = createServiceClient()
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name, logo_url')
    .eq('is_active', true)
    .order('name')

  return <AdminLayout allOrganizations={orgs || []}>{children}</AdminLayout>
}
