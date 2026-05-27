import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code?.trim()) return NextResponse.json({ valid: false })

  const admin = createServiceClient()

  const { data } = await admin
    .from('referral_codes')
    .select('id, code, referrer_name, discount_type, discount_value, is_active, expires_at, max_uses, times_used')
    .eq('code', code.toUpperCase().trim())
    .single()

  if (!data || !data.is_active) return NextResponse.json({ valid: false })
  if (data.expires_at && new Date(data.expires_at) < new Date()) return NextResponse.json({ valid: false })
  if (data.max_uses !== null && data.times_used >= data.max_uses) return NextResponse.json({ valid: false })

  return NextResponse.json({
    valid:         true,
    id:            data.id,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    referrer_name: data.referrer_name,
  })
}
