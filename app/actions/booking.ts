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

  return (data ?? []).map((a: { scheduled_at: string }) => {
    const d = new Date(a.scheduled_at)
    const bogotaStr = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
      timeZone: 'America/Bogota',
    }).format(d)
    // bogotaStr format: "2026-05-15, 15:00:00" → normalize to ISO-like
    const [datePart, timePart] = bogotaStr.split(', ')
    return `${datePart}T${timePart}`
  })
}
