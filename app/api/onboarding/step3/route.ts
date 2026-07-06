import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/session'

interface Schedule {
  day_of_week: number
  start_time: string
  end_time: string
}

export async function POST(req: NextRequest) {
  let ctx
  try {
    ctx = await requireOrgContext()
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }
  const { orgId } = ctx

  const { doctorId, schedules } = await req.json() as { doctorId: string; schedules: Schedule[] }

  if (!doctorId || !Array.isArray(schedules) || schedules.length === 0) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const admin = createServiceClient()

  // schedules no tiene organization_id: el fence es que el doctor pertenezca a la org.
  const { data: doctor } = await admin
    .from('doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!doctor) {
    return NextResponse.json({ error: 'Médico no válido para esta organización.' }, { status: 403 })
  }

  const rows = schedules.map((s) => ({
    doctor_id: doctorId,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    is_recurring: true,
    active: true,
    location_id: null,
  }))

  const { error } = await admin.from('schedules').insert(rows)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
