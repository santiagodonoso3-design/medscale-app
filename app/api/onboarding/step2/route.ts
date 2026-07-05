import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkPlanLimit, limitErrorMessage } from '@/lib/plans'
import { requireOrgContext } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  // Identidad derivada de la sesión — nunca del body. Sin sesión → 401.
  let ctx
  try {
    ctx = await requireOrgContext()
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }
  const { orgId, userId, role } = ctx

  // Solo el owner crea médicos (doctors es 'full' solo para owner en permissions).
  if (role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }

  const { name, specialty, duration } = await req.json()

  if (!name || !specialty) {
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
