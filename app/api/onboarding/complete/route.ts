import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/session'

export async function POST(_req: NextRequest) {
  // La org se deriva de la sesión — nunca del body (antes era IDOR).
  let ctx
  try {
    ctx = await requireOrgContext()
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }
  const { orgId } = ctx

  const admin = createServiceClient()

  const { error } = await admin
    .from('organizations')
    .update({ onboarding_completed: true })
    .eq('id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
