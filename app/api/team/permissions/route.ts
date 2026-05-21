import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'owner') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { memberId, permissions } = await req.json()

  const admin = createServiceClient()

  const { data: target, error: fetchError } = await admin
    .from('organization_members')
    .select('id, organization_id, role')
    .eq('id', memberId)
    .single()

  if (fetchError || !target) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (target.organization_id !== session.orgId) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'No se pueden editar los permisos de un admin' }, { status: 403 })

  const { error: updateError } = await admin
    .from('organization_members')
    .update({ permissions: permissions ?? null })
    .eq('id', memberId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
