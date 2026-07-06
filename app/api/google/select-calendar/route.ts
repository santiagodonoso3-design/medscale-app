import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    // Identidad de sesión — nunca del body. Sin sesión → 401.
    let ctx
    try {
      ctx = await requireOrgContext()
    } catch {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { userId, orgId, role } = ctx

    const { doctor_id, calendar_id } = await request.json()

    if (!doctor_id || !calendar_id) {
      return Response.json({ error: 'Missing doctor_id or calendar_id' }, { status: 400 })
    }

    const admin = createServiceClient()

    // El doctor debe pertenecer a la org del que llama (traemos metadata de paso).
    const { data: doctor } = await admin
      .from('doctors')
      .select('metadata')
      .eq('id', doctor_id)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!doctor) return Response.json({ error: 'No autorizado' }, { status: 403 })

    // owner/staff gestionan cualquier doctor de su org; un doctor solo el suyo.
    if (role === 'doctor') {
      const { data: member } = await admin
        .from('organization_members')
        .select('doctor_id')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .single()
      if (!member?.doctor_id || member.doctor_id !== doctor_id) {
        return Response.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    // Strip out the temporary google_calendars list from metadata
    const existingMetadata: Record<string, unknown> = { ...(doctor.metadata ?? {}) }
    delete existingMetadata['google_calendars']

    await admin.from('doctors').update({
      google_calendar_id:           calendar_id,
      google_calendar_connected_at: new Date().toISOString(),
      metadata:                     existingMetadata,
    }).eq('id', doctor_id).eq('organization_id', orgId)

    return Response.json({ ok: true })
  } catch (e) {
    console.error('[google/select-calendar] error:', e)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
