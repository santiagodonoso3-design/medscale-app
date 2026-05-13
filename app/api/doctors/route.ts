import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkPlanLimit, limitErrorMessage } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const { orgId, userId, specialty, metadata, is_active } = await req.json()

  if (!orgId || !userId) {
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
      user_id: userId,
      specialty: specialty ?? null,
      metadata: metadata ?? {},
      is_active: is_active ?? true,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, doctor })
}
