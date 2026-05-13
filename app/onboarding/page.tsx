export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const admin = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!member) redirect('/login')

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, onboarding_completed')
    .eq('id', member.organization_id)
    .single()

  if (!org) redirect('/login')
  if (org.onboarding_completed) redirect('/dashboard')

  return <OnboardingWizard organizationId={org.id} organizationName={org.name} />
}
