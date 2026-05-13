import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/admin/layout'

const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !SUPERADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    redirect('/dashboard')
  }

  const admin = createServiceClient()
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name, logo_url')
    .eq('is_active', true)
    .order('name')

  return <AdminLayout allOrganizations={orgs || []}>{children}</AdminLayout>
}
