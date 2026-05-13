import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { orgId, doctorId } = await req.json()

  if (!orgId || !doctorId) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const admin = createServiceClient()

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
