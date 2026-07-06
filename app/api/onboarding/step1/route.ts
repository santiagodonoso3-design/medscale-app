import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/session'

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function POST(req: NextRequest) {
  // La org se deriva de la sesión — nunca del body (antes era IDOR).
  let ctx
  try {
    ctx = await requireOrgContext()
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }
  const { orgId } = ctx

  const { name, city, phone, contact_email } = await req.json()

  if (!name || !city) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

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
