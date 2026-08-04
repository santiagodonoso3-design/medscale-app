import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { seedLeadStatuses } from '@/lib/organizations/seed-statuses'

// New orgs always start on the lowest tier. Plan upgrades happen only via
// superadmin (protected) or the Mercado Pago webhook — never from the client.
const DEFAULT_PLAN = 'consultorio'

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function POST(req: NextRequest) {
  // The owner of the new org is ALWAYS the authenticated session user.
  // Never trust a user_id from the body.
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { clinic_name, phone, referral_code } = await req.json()

  if (!clinic_name || !String(clinic_name).trim()) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const name = String(clinic_name).trim()
  const slug = slugify(name)
  if (!slug) {
    return NextResponse.json({ error: 'Nombre de organización inválido.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Anti-abuse: a legitimate registration never has a prior org owned by this
  // user. Blocks mass org creation from a single account.
  const { data: existingOwnership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle()

  if (existingOwnership) {
    return NextResponse.json(
      { error: 'Esta cuenta ya tiene una organización.' },
      { status: 409 }
    )
  }

  // Slug collision check
  const { data: slugTaken } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()

  if (slugTaken) {
    return NextResponse.json(
      { error: 'Ya existe una organización con ese nombre. Prueba con otro.' },
      { status: 409 }
    )
  }

  // Validate referral code server-side if provided
  let referralCodeRecord: { id: string; times_used: number } | null = null
  if (referral_code) {
    const { data: codeData } = await supabase
      .from('referral_codes')
      .select('id, times_used, is_active, expires_at, max_uses')
      .eq('code', String(referral_code).toUpperCase().trim())
      .single()

    if (
      codeData &&
      codeData.is_active &&
      (!codeData.expires_at || new Date(codeData.expires_at) >= new Date()) &&
      (codeData.max_uses === null || codeData.times_used < codeData.max_uses)
    ) {
      referralCodeRecord = { id: codeData.id, times_used: codeData.times_used }
    }
  }

  // Create organization — plan is fixed server-side, never from the client.
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      plan:             DEFAULT_PLAN,
      contact_phone:    phone ?? null,
      referral_code_id: referralCodeRecord?.id ?? null,
    })
    .select('id')
    .single()

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  await seedLeadStatuses(supabase, org.id)

  // Create organization member — owner is ALWAYS the session user.
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id:         user.id,
      role:            'owner',
    })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Track referral usage
  if (referralCodeRecord) {
    await Promise.all([
      supabase.from('referral_uses').insert({
        referral_code_id: referralCodeRecord.id,
        organization_id:  org.id,
        status:           'active',
      }),
      supabase
        .from('referral_codes')
        .update({ times_used: referralCodeRecord.times_used + 1 })
        .eq('id', referralCodeRecord.id),
    ])
  }

  return NextResponse.json({ ok: true, redirect: '/onboarding' })
}
