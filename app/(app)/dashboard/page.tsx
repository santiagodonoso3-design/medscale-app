export const dynamic    = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { unstable_noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getDashboardRawData, getDashboardYears } from './actions'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  unstable_noStore()

  const supabase = await createClient()
  const admin = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: member } = await admin
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .single()

  if (!member?.organization_id) redirect('/onboarding')

  if (member.role === 'doctor') redirect('/scheduling/calendar')

  const orgId = member.organization_id

  const { data: org } = await admin
    .from('organizations')
    .select('onboarding_completed')
    .eq('id', orgId)
    .single()

  if (!org?.onboarding_completed) redirect('/onboarding')

  const currentYear = Number(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'America/Bogota' }).format(new Date())
  )

  const [rawData, availableYears] = await Promise.all([
    getDashboardRawData(currentYear, orgId),
    getDashboardYears(orgId),
  ])

  if (!rawData) {
    return (
      <div className="p-6 xl:p-10">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
          <p className="text-sm text-red-700">Error cargando el dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 xl:p-10">
      <DashboardClient initialData={rawData} availableYears={availableYears} orgId={orgId} />
    </div>
  )
}
