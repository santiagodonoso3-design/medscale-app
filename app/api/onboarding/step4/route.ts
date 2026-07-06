import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  let ctx
  try {
    ctx = await requireOrgContext()
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }
  const { orgId } = ctx

  const { doctorId } = await req.json()

  if (!doctorId) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const admin = createServiceClient()

  // Validar que el doctor pertenece a la org antes de vincularlo al tipo de cita.
  const { data: doctor } = await admin
    .from('doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!doctor) {
    return NextResponse.json({ error: 'Médico no válido para esta organización.' }, { status: 403 })
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
  }

  const { error: typeError } = await admin
    .from('appointment_types')
    .insert({
      organization_id: orgId,
      name: 'Consulta general',
      slug: 'consulta-general',
      duration_minutes: 30,
      modality: 'in_person',
      assignment_mode: 'one_on_one',
      active: true,
      doctor_ids: [doctorId],
    })

  if (typeError) {
    return NextResponse.json({ error: typeError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slug: org.slug })
}
