import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkPlanLimit, limitErrorMessage } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const { orgId, name, specialty, duration, userId } = await req.json()

  if (!orgId || !name || !specialty || !userId) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const check = await checkPlanLimit(orgId, 'doctors')
  if (!check.allowed) {
    return NextResponse.json({ error: limitErrorMessage(check, 'médicos') }, { status: 403 })
  }

  const admin = createServiceClient()

  const { data: doctor, error } = await admin
    .from('doctors')
    .insert({
      organization_id: orgId,
      metadata: { name: name.trim(), specialty: specialty.trim() },
      default_duration: duration ?? 30,
      is_active: true,
      user_id: userId,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, doctorId: doctor.id })
}
