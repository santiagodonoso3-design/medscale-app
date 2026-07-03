import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgIdFromUser } from '@/lib/get-org-id'
import { CompleteProfileForm } from './complete-profile-form'

export const dynamic = 'force-dynamic'

export default async function CompleteProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Already has an org → nothing to complete, send them into the app.
  const orgId = await getOrgIdFromUser(user.id)
  if (orgId) redirect('/dashboard')

  const clinicName   = (user.user_metadata?.clinic_name as string | undefined) ?? ''
  const referralCode = (user.user_metadata?.referral_code as string | undefined) ?? ''

  return (
    <CompleteProfileForm
      defaultClinicName={clinicName}
      defaultReferralCode={referralCode}
    />
  )
}
