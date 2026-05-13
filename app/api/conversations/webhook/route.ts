import { createServiceClient } from '@/lib/supabase/server'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-webhook-secret')
  const expectedSecret = process.env.WEBHOOK_SECRET

  if (!expectedSecret || secret !== expectedSecret) {
    return jsonResponse({ success: false, error: 'Autenticación inválida' }, 401)
  }

  try {
    const body = await request.json()

    const { org_id, phone, sender_name, message_in, message_out, channel } = body as {
      org_id?: string
      phone?: string
      sender_name?: string
      message_in?: string
      message_out?: string
      channel?: string
    }

    if (!org_id || !phone || !message_in || !message_out) {
      return jsonResponse({ success: false, error: 'Faltan campos requeridos: org_id, phone, message_in, message_out' }, 400)
    }

    const supabase = createServiceClient()

    const { data: leadRow } = await supabase
      .from('leads')
      .select('id')
      .eq('organization_id', org_id)
      .eq('contact_phone', phone)
      .maybeSingle()

    const lead_id = leadRow?.id ?? null

    const { error: insertError } = await supabase.from('messages').insert([
      {
        organization_id: org_id,
        lead_id,
        channel: channel ?? 'whatsapp',
        direction: 'inbound',
        content: message_in,
        sender_name: sender_name ?? null,
        sender_phone: phone,
      },
      {
        organization_id: org_id,
        lead_id,
        channel: channel ?? 'whatsapp',
        direction: 'outbound',
        content: message_out,
        sender_name: 'Agente AI',
        sender_phone: null,
      },
    ])

    if (insertError) {
      console.error('Messages insert error', insertError)
      return jsonResponse({ success: false, error: insertError.message }, 500)
    }

    return jsonResponse({ success: true, lead_id, messages_count: 2 }, 201)
  } catch (error) {
    console.error('Webhook conversations error', error)
    return jsonResponse({ success: false, error: 'Error interno en webhook' }, 500)
  }
}
