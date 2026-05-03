import { createClient } from '@/lib/supabase/server'
import { CalendarClient } from '@/components/scheduling/calendar-client-fixed'

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <CalendarClient userId={user?.id ?? null} />
}
