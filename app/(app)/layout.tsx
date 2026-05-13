import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getOrgIdFromUser } from '@/lib/get-org-id'
import { OrgSidebar } from '@/components/org/sidebar'

export default async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const orgId = user ? await getOrgIdFromUser(user.id) : null

  const { data: organization } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()

  const { data: memberRecord } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user?.id)
    .eq('organization_id', orgId)
    .single()

  const userFullName = user?.email || 'Usuario del equipo'

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <OrgSidebar
          orgName={organization?.name || 'Medscale AI'}
          userName={userFullName}
          userEmail={user?.email || undefined}
          userRole={(memberRecord?.role as 'owner' | 'staff' | 'doctor') ?? null}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
