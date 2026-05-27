import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('procedures')
    .select('id, name, price, is_active, created_at')
    .eq('organization_id', session.orgId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { name, price } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (price == null || isNaN(Number(price)) || Number(price) < 0)
    return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('procedures')
    .insert({ organization_id: session.orgId, name: name.trim(), price: Number(price) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { id, name, price, is_active } = body
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = String(name).trim()
  if (price !== undefined) updates.price = Number(price)
  if (is_active !== undefined) updates.is_active = Boolean(is_active)

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('procedures')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', session.orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const admin = createServiceClient()
  const { error } = await admin
    .from('procedures')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
