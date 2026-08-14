import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getImpersonatedOrgId } from '@/lib/admin/impersonate'
import { OrgSidebar } from '@/components/org/sidebar'

export default async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) {
    // getSession() devuelve null tanto para "no autenticado" como para
    // "autenticado sin organización" (ej. signup OAuth sin onboarding).
    // Separar ambos casos evita el loop /login <-> /dashboard del middleware.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Platform admins sin org van al panel, no a crear una clínica
      const adminClient = createServiceClient()
      const { data: pa } = await adminClient
        .from('platform_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (pa) redirect('/admin')
      redirect('/onboarding')
    }
    redirect('/login')
  }

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
    .select('id, scope')
    .eq('user_id', session.user.id)
    .single()

  if (platformAdmin) {
    isPlatformAdmin = true

    // null = alcance global; [] = asignado a cero clínicas (lista vacía, nunca todas)
    let allowedOrgIds: string[] | null = null
    if (platformAdmin.scope !== 'global') {
      const { data: assignments } = await admin
        .from('platform_admin_organizations')
        .select('organization_id')
        .eq('platform_admin_id', platformAdmin.id)
      allowedOrgIds = (assignments ?? []).map(a => a.organization_id as string)
    }

    let orgsQuery = admin
      .from('organizations')
      .select('id, name, logo_url')
      .eq('is_active', true)
    if (allowedOrgIds !== null) orgsQuery = orgsQuery.in('id', allowedOrgIds)
    const { data: orgs } = await orgsQuery.order('name')
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
          permissions={session.permissions}
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
