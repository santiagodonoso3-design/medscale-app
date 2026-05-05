import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_SOURCES = ['whatsapp', 'instagram', 'facebook', 'web', 'book', 'referido', 'manual']

// n8n todavía envía 'manychat' — se mapea a 'whatsapp' hasta que envíe el canal real
const SOURCE_MAP: Record<string, string> = {
  manychat:     'whatsapp',
  manychat_n8n: 'whatsapp',
}

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

    const {
      org_id,
      full_name,
      phone,
      source,
      email,
      notes,
      custom_fields,
    } = body as {
      org_id?: string
      full_name?: string
      phone?: string
      source?: string
      email?: string
      notes?: string
      custom_fields?: Record<string, unknown>
    }

    if (!org_id || !full_name || !phone || !source) {
      return jsonResponse({ success: false, error: 'Faltan campos requeridos' }, 400)
    }

    const normalizedSource = SOURCE_MAP[source] ?? source
    if (!ALLOWED_SOURCES.includes(normalizedSource)) {
      return jsonResponse({ success: false, error: 'Fuente no válida' }, 400)
    }

    const supabase = await createServiceClient()

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', org_id)
      .single()

    if (orgError || !org) {
      return jsonResponse({ success: false, error: 'Organización no encontrada' }, 404)
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: org_id,
        contact_name: full_name,
        contact_phone: phone,
        contact_email: email || null,
        source: normalizedSource,
        notes: notes || null,
        status: 'contactado',
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      console.error('Lead create error', leadError)
      return jsonResponse({ success: false, error: leadError?.message || 'Error creando lead' }, 500)
    }

    if (custom_fields && typeof custom_fields === 'object') {
      const customEntries = Object.entries(custom_fields).filter(
        ([, value]) => value !== null && value !== undefined && value !== ''
      )

      if (customEntries.length > 0) {
        const fieldNames = customEntries.map(([key]) => key)
        const { data: existingFields } = await supabase
          .from('lead_fields')
          .select('id, name')
          .eq('organization_id', org_id)
          .in('name', fieldNames)

        const existingMap = new Map<string, string>()
        ;(existingFields || []).forEach((field: any) => {
          existingMap.set(field.name, field.id)
        })

        const inserts: Array<{ lead_id: string; lead_field_id: string; value: string }> = []

        for (const [key, value] of customEntries) {
          let leadFieldId = existingMap.get(key)

          if (!leadFieldId) {
            const { data: createdField, error: createFieldError } = await supabase
              .from('lead_fields')
              .insert({
                organization_id: org_id,
                name: key,
                field_type: 'text',
                required: false,
                options: [],
                order_index: 0,
                metadata: { created_by: 'webhook' },
              })
              .select('id')
              .single()

            if (createFieldError || !createdField) {
              console.error('Lead field create error', createFieldError)
              continue
            }
            leadFieldId = createdField.id
          }

          if (!leadFieldId) {
            continue
          }

          inserts.push({
            lead_id: lead.id,
            lead_field_id: leadFieldId,
            value: String(value),
          })
        }

        if (inserts.length > 0) {
          const { error: leadValuesError } = await supabase.from('lead_values').insert(inserts)
          if (leadValuesError) {
            console.error('Lead values insert error', leadValuesError)
          }
        }
      }
    }

    return jsonResponse({ success: true, lead_id: lead.id }, 201)
  } catch (error) {
    console.error('Webhook lead error', error)
    return jsonResponse({ success: false, error: 'Error interno en webhook' }, 500)
  }
}
