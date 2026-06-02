import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_TIERS = ['starter', 'growth', 'scale'] as const
type Tier = typeof VALID_TIERS[number]

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { tier } = body as { tier: unknown }

  if (!tier || !VALID_TIERS.includes(tier as Tier)) {
    return NextResponse.json(
      { error: 'El tier debe ser starter, growth o scale' },
      { status: 400 },
    )
  }

  const planMap: Record<Tier, string | undefined> = {
    starter: process.env.MP_PLAN_STARTER,
    growth:  process.env.MP_PLAN_GROWTH,
    scale:   process.env.MP_PLAN_SCALE,
  }

  const planId = planMap[tier as Tier]
  if (!planId) {
    console.error(`[billing/subscribe] Plan ID not configured for tier: ${tier}`)
    return NextResponse.json(
      { error: `Plan de Mercado Pago no configurado para el tier "${tier}"` },
      { status: 500 },
    )
  }

  const checkoutUrl = `https://www.mercadopago.com.co/subscriptions/checkout?preapproval_plan_id=${planId}&external_reference=${session.orgId}`

  const admin = createServiceClient()

  try {
    const { error: dbError } = await admin
      .from('organizations')
      .update({
        subscription_status: 'pending',
        mp_payer_email:      session.user.email,
      })
      .eq('id', session.orgId)

    if (dbError) {
      console.error('[billing/subscribe] DB update error:', dbError)
      return NextResponse.json({ error: 'Error guardando estado de suscripción' }, { status: 500 })
    }
  } catch (err) {
    console.error('[billing/subscribe] Unexpected error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

  return NextResponse.json({ init_point: checkoutUrl })
}
