import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CalendarClient } from '@/components/scheduling/calendar-client-fixed'

export default async function CalendarPage() {
  const supabase = await createClient()
  const admin = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  let doctorId: string | null = null
  if (user) {
    const { data: member } = await admin
      .from('organization_members')
      .select('role, doctor_id')
      .eq('user_id', user.id)
      .single()

    if (member?.role === 'doctor' && member?.doctor_id) {
      doctorId = member.doctor_id
    }
  }

  return <CalendarClient userId={user?.id ?? null} doctorId={doctorId} />
}
