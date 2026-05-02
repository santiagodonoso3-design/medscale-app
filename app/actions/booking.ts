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
): Promise<string[]> {
  if (!doctorId) return []

  const startOfMonth = new Date(Date.UTC(year, month, 1))
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59))

  const { data } = await supabaseAdmin
    .from('appointments')
    .select('scheduled_at')
    .eq('doctor_id', doctorId)
    .gte('scheduled_at', startOfMonth.toISOString())
    .lte('scheduled_at', endOfMonth.toISOString())
    .in('status', ['scheduled', 'confirmed'])

  return (data ?? []).map((a: { scheduled_at: string }) => a.scheduled_at)
}
