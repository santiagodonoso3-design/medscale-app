export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { OnboardingWizard } from './OnboardingWizard'

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createServiceClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, onboarding_completed')
    .eq('id', session.orgId)
    .single()

  if (!org) redirect('/login')
  if (org.onboarding_completed) redirect('/dashboard')

  return (
    <OnboardingWizard
      orgId={org.id}
      orgName={org.name}
      userEmail={session.user.email ?? ''}
      userId={session.user.id}
    />
  )
}
