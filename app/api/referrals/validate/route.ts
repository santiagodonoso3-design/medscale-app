import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Endpoint PÚBLICO (se llama en el registro sin sesión).
// DEUDA: rate-limit por IP para prevenir enumeración de códigos. No hay helper
// de rate-limiting en el repo; se deja anotado, no se inventa infraestructura.

export async function GET(req: NextRequest) {
  const raw  = req.nextUrl.searchParams.get('code')
  const code = raw?.toUpperCase().trim() ?? ''

  if (!code) return NextResponse.json({ valid: false })

  const admin = createServiceClient()

  const { data, error } = await admin
    .from('referral_codes')
    .select('id, discount_type, discount_value, is_active, expires_at, max_uses, times_used')
    .eq('code', code)
    .maybeSingle()

  // Sin logs del código ni del resultado, y sin campos _debug/PII en la respuesta.
  if (error) return NextResponse.json({ valid: false })
  if (!data) return NextResponse.json({ valid: false })
  if (!data.is_active) return NextResponse.json({ valid: false })
  if (data.expires_at && new Date(data.expires_at) < new Date()) return NextResponse.json({ valid: false })
  if (data.max_uses !== null && data.times_used >= data.max_uses) return NextResponse.json({ valid: false })

  return NextResponse.json({
    valid:          true,
    id:             data.id,
    discount_type:  data.discount_type,
    discount_value: data.discount_value,
  })
}
