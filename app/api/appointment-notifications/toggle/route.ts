import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_EVENTS = ['confirmation', 'reminder', 'cancellation', 'reschedule'] as const

// Mass update: activa/desactiva un event_type para TODOS los tipos de cita de
// la org de sesión. El copy por tipo sigue editándose en /settings/notifications.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { event_type?: string; enabled?: boolean }
  if (!body.event_type || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'event_type y enabled requeridos' }, { status: 400 })
  }
  if (!(VALID_EVENTS as readonly string[]).includes(body.event_type)) {
    return NextResponse.json({ error: 'event_type inválido' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { error, count } = await admin
    .from('appointment_type_notifications')
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('organization_id', session.orgId)
    .eq('event_type', body.event_type)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated: count ?? 0 })
}
