import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function POST(req: NextRequest) {
  const { plan, clinic_name, phone, user_id, referral_code } = await req.json()

  if (!plan || !clinic_name || !user_id) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const supabase = createServiceClient()

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

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name:               clinic_name,
      slug:               slugify(clinic_name),
      plan,
      contact_phone:      phone ?? null,
      referral_code_id:   referralCodeRecord?.id ?? null,
    })
    .select('id')
    .single()

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  // Create organization member
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
