import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { BillingContent } from './billing-content'

export default async function BillingPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/crm')

  const admin = createServiceClient()
  const { data: org } = await admin
    .from('organizations')
    .select('plan, subscription_status')
    .eq('id', session.orgId)
    .single()

  return (
    <BillingContent
      currentPlan={org?.plan ?? 'free'}
      subscriptionStatus={org?.subscription_status ?? null}
    />
  )
}
