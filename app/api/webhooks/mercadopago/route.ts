import { createHmac } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request) {
  // ── PASO 1: Leer body crudo y headers ────────────────────────────────────────

  const rawBody = await request.text()

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ success: false, error: 'Body inválido' }, 400)
  }

  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  // data.id viene como query param en la URL, NO en el body
  const url    = new URL(request.url)
  const dataId = url.searchParams.get('data.id')

  // ── PASO 2: Validar firma ─────────────────────────────────────────────────────

  if (!xSignature || !process.env.MP_WEBHOOK_SECRET) {
    return jsonResponse({ error: 'No autorizado' }, 401)
  }

  let ts = ''
  let v1 = ''
  for (const part of xSignature.split(',')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const key = part.slice(0, eqIdx).trim()
    const val = part.slice(eqIdx + 1).trim()
    if (key === 'ts') ts = val
    if (key === 'v1') v1 = val
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const computed = createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex')

  if (computed !== v1) {
    console.error('[mp-webhook] firma inválida — computed:', computed, 'received:', v1)
    return jsonResponse({ error: 'Firma inválida' }, 401)
  }

  // ── PASO 3 en adelante: lógica principal ──────────────────────────────────────

  try {
    const type = body.type as string | undefined

    // Ignorar eventos que no son de suscripciones (siempre 200 para que MP no reintente)
    if (!type?.includes('preapproval') && type !== 'subscription_preapproval') {
      return jsonResponse({ success: true, ignored: true })
    }

    // Re-consultar a MP — nunca confiar en el body
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN_TEST}` },
    })

    if (!mpRes.ok) {
      console.error(`[mp-webhook] Error re-consultando preapproval ${dataId}: ${mpRes.status}`)
      return jsonResponse({ success: true, error: 'MP lookup failed' }) // 200 — no reintentar
    }

    const mp = await mpRes.json()
    const { status, external_reference, preapproval_plan_id, payer_email } = mp as {
      status:               string
      external_reference:   string
      preapproval_plan_id:  string
      payer_email:          string
    }

    // ── PASO 4: Idempotencia via subscription_events ──────────────────────────

    const admin = createServiceClient()

    const { error: eventError } = await admin
      .from('subscription_events')
      .insert({
        org_id:      external_reference,
        mp_event_id: `${dataId}-${status}`,
        type,
        payload:     mp,
      })

    if (eventError) {
      // Código 23505 = unique_violation (evento duplicado)
      if (eventError.code === '23505') {
        return jsonResponse({ success: true, duplicate: true })
      }
      console.error('[mp-webhook] Error insertando subscription_event:', eventError)
      return jsonResponse({ error: 'Error interno' }, 500)
    }

    // ── PASO 5: Mapear plan y actualizar org ──────────────────────────────────

    const planToTier: Record<string, string> = {
      [process.env.MP_PLAN_STARTER ?? '']: 'starter',
      [process.env.MP_PLAN_GROWTH  ?? '']: 'growth',
      [process.env.MP_PLAN_SCALE   ?? '']: 'scale',
    }
    const tier = planToTier[preapproval_plan_id]

    let updates: Record<string, unknown>

    if (status === 'authorized') {
      if (!tier) {
        console.error(
          `[mp-webhook] preapproval_plan_id "${preapproval_plan_id}" no matcheó ningún tier conocido — revisar MP_PLAN_* env vars`
        )
        updates = {
          subscription_status: 'authorized',
          mp_preapproval_id:   dataId,
          mp_payer_email:      payer_email,
        }
      } else {
        updates = {
          plan:                tier,
          subscription_status: 'authorized',
          mp_preapproval_id:   dataId,
          mp_payer_email:      payer_email,
        }
      }
    } else if (status === 'paused') {
      updates = { subscription_status: 'paused' }
    } else if (status === 'cancelled') {
      updates = { plan: 'free', subscription_status: 'cancelled' }
    } else {
      updates = { subscription_status: status }
    }

    const { error: updateError } = await admin
      .from('organizations')
      .update(updates)
      .eq('id', external_reference)

    if (updateError) {
      console.error('[mp-webhook] Error actualizando organization:', updateError)
      return jsonResponse({ error: 'Error interno' }, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('[mp-webhook] Error inesperado:', err)
    return jsonResponse({ error: 'Error interno' }, 500)
  }
}
