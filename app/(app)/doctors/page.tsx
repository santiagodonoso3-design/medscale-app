import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DoctorsPageClient } from '@/components/doctors/doctors-page-client'

export default async function DoctorsPage() {
  const supabase = await createClient()
  const admin = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  let isDoctor = false
  let userDoctorId: string | null = null

  if (user) {
    const { data: member } = await admin
      .from('organization_members')
      .select('role, doctor_id')
      .eq('user_id', user.id)
      .single()

    if (member?.role === 'doctor') {
      isDoctor = true
      userDoctorId = member.doctor_id ?? null
    }
  }

  return (
    <div className="p-6 xl:p-10">
      <DoctorsPageClient isDoctor={isDoctor} userDoctorId={userDoctorId} />
    </div>
  )
}
