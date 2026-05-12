import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { OrgSidebar } from '@/components/org/sidebar'

export default async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, first_name, last_name')
    .eq('id', user?.id)
    .single()

  const { data: organization } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', userRecord?.organization_id)
    .single()

  const { data: memberRecord } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user?.id)
    .eq('organization_id', userRecord?.organization_id)
    .single()

  const userFullName = [userRecord?.first_name, userRecord?.last_name].filter(Boolean).join(' ') || 'Usuario del equipo'

  return (
    <div className="flex min-h-screen bg-white">
      <OrgSidebar
        orgName={organization?.name || 'Medscale AI'}
        userName={userFullName}
        userEmail={user?.email || undefined}
        userRole={(memberRecord?.role as 'owner' | 'staff' | 'doctor') ?? null}
      />
      <main className="flex-1 min-w-0 overflow-x-hidden bg-white">{children}</main>
    </div>
  )
}
