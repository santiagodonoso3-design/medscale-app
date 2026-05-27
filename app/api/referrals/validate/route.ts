import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const raw  = req.nextUrl.searchParams.get('code')
  const code = raw?.toUpperCase().trim() ?? ''

  console.log('[referrals/validate] raw code received:', JSON.stringify(raw))
  console.log('[referrals/validate] normalized code:', JSON.stringify(code))

  if (!code) return NextResponse.json({ valid: false })

  const admin = createServiceClient()

  const { data, error } = await admin
    .from('referral_codes')
    .select('id, code, referrer_name, discount_type, discount_value, is_active, expires_at, max_uses, times_used')
    .eq('code', code)
    .maybeSingle()

  console.log('[referrals/validate] query result:', JSON.stringify({ data, error }))

  if (error) {
    console.error('[referrals/validate] Supabase error:', error)
    return NextResponse.json({ valid: false, _debug_error: error.message })
  }

  if (!data)            return NextResponse.json({ valid: false, _debug: 'no_row' })
  if (!data.is_active)  return NextResponse.json({ valid: false, _debug: 'inactive' })
  if (data.expires_at && new Date(data.expires_at) < new Date()) return NextResponse.json({ valid: false, _debug: 'expired' })
  if (data.max_uses !== null && data.times_used >= data.max_uses) return NextResponse.json({ valid: false, _debug: 'max_uses' })

  return NextResponse.json({
    valid:          true,
    id:             data.id,
    discount_type:  data.discount_type,
    discount_value: data.discount_value,
    referrer_name:  data.referrer_name,
  })
}
