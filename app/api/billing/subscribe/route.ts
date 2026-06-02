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

  const admin = createServiceClient()

  try {
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.MP_ACCESS_TOKEN_TEST}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: planId,
        reason:              `MedScale ${(tier as string).charAt(0).toUpperCase() + (tier as string).slice(1)}`,
        external_reference:  session.orgId,
        payer_email:         session.user.email,
        back_url:            'https://app.medscale.app/billing/success',
        status:              'pending',
      }),
    })

    if (!mpRes.ok) {
      const errBody = await mpRes.text()
      console.error(`[billing/subscribe] MP error ${mpRes.status}:`, errBody)
      return NextResponse.json(
        { error: 'Error al crear suscripción en Mercado Pago' },
        { status: 502 },
      )
    }

    const data = await mpRes.json()

    const { error: dbError } = await admin
      .from('organizations')
      .update({
        mp_preapproval_id:   data.id,
        mp_payer_email:      session.user.email,
        subscription_status: 'pending',
      })
      .eq('id', session.orgId)

    if (dbError) {
      console.error('[billing/subscribe] DB update error:', dbError)
      return NextResponse.json({ error: 'Error guardando suscripción' }, { status: 500 })
    }

    return NextResponse.json({ init_point: data.init_point })
  } catch (err) {
    console.error('[billing/subscribe] Unexpected error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
