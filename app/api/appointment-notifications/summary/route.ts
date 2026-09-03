import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

// Read-only: estado agregado de appointment_type_notifications por event_type
// para la org de sesión (cuántos tipos de cita lo tienen activo).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('appointment_type_notifications')
    .select('event_type, enabled, hours_before')
    .eq('organization_id', session.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Summary = {
    event_type: string
    total_types: number
    enabled_count: number
    hours_before: number | null
  }
  const acc: Record<string, Summary> = {}
  for (const row of (data ?? [])) {
    const et = row.event_type as string
    if (!acc[et]) acc[et] = { event_type: et, total_types: 0, enabled_count: 0, hours_before: null }
    acc[et].total_types++
    if (row.enabled) acc[et].enabled_count++
    // hours_before: primer no-null (todos deberían coincidir por event_type)
    if (acc[et].hours_before === null && row.hours_before !== null) {
      acc[et].hours_before = row.hours_before as number
    }
  }
  return NextResponse.json(Object.values(acc))
}
