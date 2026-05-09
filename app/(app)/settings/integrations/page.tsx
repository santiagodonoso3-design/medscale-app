import { createClient, createServiceClient } from '@/lib/supabase/server'
import { IntegrationsContent } from './integrations-content'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const admin = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await admin
    .from('organization_members')
    .select('role, doctor_id')
    .eq('user_id', user.id)
    .single()

  const isDoctor = member?.role === 'doctor'
  const userDoctorId = member?.doctor_id ?? null

  return <IntegrationsContent isDoctor={isDoctor} userDoctorId={userDoctorId} />
}
