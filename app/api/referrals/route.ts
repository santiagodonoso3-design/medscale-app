import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!(user && SUPERADMIN_EMAILS.includes(user.email?.toLowerCase() ?? ''))
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient()

  const [{ data: codes, error }, { data: uses }] = await Promise.all([
    admin.from('referral_codes').select('*').order('created_at', { ascending: false }),
    admin.from('referral_uses')
      .select('*, organizations(name, slug)')
      .order('applied_at', { ascending: false })
      .limit(50),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ codes: codes ?? [], uses: uses ?? [] })
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.code?.trim()) return NextResponse.json({ error: 'Código es obligatorio' }, { status: 400 })
  if (!body.referrer_name?.trim()) return NextResponse.json({ error: 'Nombre del referidor es obligatorio' }, { status: 400 })
  if (body.discount_value == null) return NextResponse.json({ error: 'Valor de descuento es obligatorio' }, { status: 400 })

  const admin = createServiceClient()

  const { data, error } = await admin
    .from('referral_codes')
    .insert({
      code:                       body.code.toUpperCase().trim(),
      referrer_name:              body.referrer_name.trim(),
      referrer_email:             body.referrer_email || null,
      referrer_phone:             body.referrer_phone || null,
      discount_type:              body.discount_type,
      discount_value:             Number(body.discount_value),
      discount_duration_months:   body.discount_duration_months ? Number(body.discount_duration_months) : null,
      commission_type:            body.commission_type || null,
      commission_value:           body.commission_value ? Number(body.commission_value) : null,
      commission_duration_months: body.commission_duration_months ? Number(body.commission_duration_months) : null,
      max_uses:                   body.max_uses ? Number(body.max_uses) : null,
      is_active:                  true,
      expires_at:                 body.expires_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createServiceClient()

  const { data, error } = await admin
    .from('referral_codes')
    .update({
      code:                       fields.code?.toUpperCase().trim(),
      referrer_name:              fields.referrer_name?.trim(),
      referrer_email:             fields.referrer_email || null,
      referrer_phone:             fields.referrer_phone || null,
      discount_type:              fields.discount_type,
      discount_value:             Number(fields.discount_value),
      discount_duration_months:   fields.discount_duration_months ? Number(fields.discount_duration_months) : null,
      commission_type:            fields.commission_type || null,
      commission_value:           fields.commission_value ? Number(fields.commission_value) : null,
      commission_duration_months: fields.commission_duration_months ? Number(fields.commission_duration_months) : null,
      max_uses:                   fields.max_uses ? Number(fields.max_uses) : null,
      is_active:                  fields.is_active,
      expires_at:                 fields.expires_at || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
