import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function POST(req: NextRequest) {
  const { orgId, name, city, phone, contact_email } = await req.json()

  if (!orgId || !name || !city) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient()

  const { error } = await admin
    .from('organizations')
    .update({
      name: name.trim(),
      slug: slugify(name.trim()),
      contact_phone: phone?.trim() || null,
      contact_email: contact_email?.trim() || null,
      metadata: { city: city.trim() },
    })
    .eq('id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
