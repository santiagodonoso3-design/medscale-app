'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function getBookedSlots(
  doctorId: string,
  year: number,
  month: number // 0-indexed (JS convention)
): Promise<{ start: string; end: string }[]> {
  if (!doctorId) return []

  const startOfMonth = new Date(Date.UTC(year, month, 1))
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59))

  const { data } = await supabaseAdmin
    .from('appointments')
    .select('scheduled_at, ends_at')
    .eq('doctor_id', doctorId)
    .gte('scheduled_at', startOfMonth.toISOString())
    .lte('scheduled_at', endOfMonth.toISOString())
    .in('status', ['scheduled', 'confirmed'])

  const toBogota = (d: Date) => {
    const str = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
      timeZone: 'America/Bogota',
    }).format(d)
    const [datePart, timePart] = str.split(', ')
    return `${datePart}T${timePart}`
  }

  return (data ?? []).map((a: any) => ({
    start: toBogota(new Date(a.scheduled_at)),
    end:   toBogota(new Date(a.ends_at)),
  }))
}
