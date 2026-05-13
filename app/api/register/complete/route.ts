import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function POST(req: NextRequest) {
  const { plan, clinic_name, phone, user_id } = await req.json()

  if (!plan || !clinic_name || !user_id) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: clinic_name,
      slug: slugify(clinic_name),
      plan,
      contact_phone: phone ?? null,
    })
    .select('id')
    .single()

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id,
      role: 'owner',
    })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, redirect: '/onboarding' })
}
