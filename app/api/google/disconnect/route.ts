import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/session'

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: NextRequest) {
  try {
    // Identidad de sesión — nunca del body. Sin sesión → 401.
    let ctx
    try {
      ctx = await requireOrgContext()
    } catch {
      return json({ error: 'No autenticado' }, 401)
    }
    const { userId, orgId, role } = ctx

    const { doctor_id } = await request.json()
    if (!doctor_id) return json({ error: 'Missing doctor_id' }, 400)

    const admin = createServiceClient()

    // El doctor debe pertenecer a la org del que llama.
    const { data: doctor } = await admin
      .from('doctors')
      .select('id')
      .eq('id', doctor_id)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!doctor) return json({ error: 'No autorizado' }, 403)

    // owner/staff gestionan cualquier doctor de su org; un doctor solo el suyo.
    if (role === 'doctor') {
      const { data: member } = await admin
        .from('organization_members')
        .select('doctor_id')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .single()
      if (!member?.doctor_id || member.doctor_id !== doctor_id) {
        return json({ error: 'No autorizado' }, 403)
      }
    }

    await admin.from('doctors').update({
      google_calendar_token:        null,
      google_calendar_id:           null,
      google_calendar_connected_at: null,
    }).eq('id', doctor_id).eq('organization_id', orgId)

    return json({ success: true })
  } catch {
    return json({ success: false }, 500)
  }
}
