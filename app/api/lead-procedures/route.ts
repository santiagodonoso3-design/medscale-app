import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const leadId = req.nextUrl.searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('lead_procedures')
    .select('id, procedure_id, procedure_price, performed_at, created_at, procedure:procedure_id(name)')
    .eq('lead_id', leadId)
    .eq('organization_id', session.orgId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { lead_id, procedure_id, procedure_price, performed_at } = body

  if (!lead_id || !procedure_id)
    return NextResponse.json({ error: 'lead_id y procedure_id requeridos' }, { status: 400 })
  if (procedure_price == null || isNaN(Number(procedure_price)) || Number(procedure_price) < 0)
    return NextResponse.json({ error: 'procedure_price inválido' }, { status: 400 })

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('lead_procedures')
    .insert({
      organization_id: session.orgId,
      lead_id,
      procedure_id,
      procedure_price: Number(procedure_price),
      performed_at: performed_at || null,
    })
    .select('id, procedure_id, procedure_price, performed_at, created_at, procedure:procedure_id(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createServiceClient()
  const { error } = await admin
    .from('lead_procedures')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
