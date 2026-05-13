import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getImpersonatedOrgId } from '@/lib/admin/impersonate'
import { OrgSidebar } from '@/components/org/sidebar'

export default async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const impersonatedOrgId = await getImpersonatedOrgId()

  const admin = createServiceClient()
  const { data: organization } = await admin
    .from('organizations')
    .select('name, logo_url, sidebar_theme')
    .eq('id', session.orgId)
    .single()

  let isPlatformAdmin = false
  let allOrganizations: { id: string; name: string; logo_url: string | null }[] = []

  const { data: platformAdmin } = await admin
    .from('platform_admins')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (platformAdmin) {
    isPlatformAdmin = true
    const { data: orgs } = await admin
      .from('organizations')
      .select('id, name, logo_url')
      .eq('is_active', true)
      .order('name')
    allOrganizations = orgs || []
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <OrgSidebar
          orgName={organization?.name || 'Medscale AI'}
          userName={session.user.email || 'Usuario del equipo'}
          userEmail={session.user.email || undefined}
          userRole={session.role}
          logoUrl={organization?.logo_url || null}
          sidebarTheme={organization?.sidebar_theme || 'dark'}
          isPlatformAdmin={isPlatformAdmin}
          allOrganizations={allOrganizations}
          isImpersonating={!!impersonatedOrgId}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
