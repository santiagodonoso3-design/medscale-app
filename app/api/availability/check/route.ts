import { getSession } from '@/lib/auth/session'
import { getGoogleCalendarBusy } from '@/lib/google/calendar'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // 1. Auth: solo staff logueado
  const session = await getSession()
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  // 2. Parse body
  const body = await request.json()
  const { doctorId, date, time, duration } = body as {
    doctorId?: string; date?: string; time?: string; duration?: number
  }
  if (!doctorId || !date || !time) {
    return new Response(JSON.stringify({ error: 'Faltan campos' }), { status: 400 })
  }

  // 3. Seguridad multi-tenant: el doctor debe pertenecer a la org de la sesión.
  //    Nunca confiar en un orgId del body — usar session.orgId.
  const admin = createServiceClient()
  const { data: doctor } = await admin
    .from('doctors')
    .select('id, organization_id')
    .eq('id', doctorId)
    .single()

  if (!doctor || doctor.organization_id !== session.orgId) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 })
  }

  // 4. Calcula el rango del slot en Bogotá
  const dur = duration ?? 30
  const slotStart = new Date(`${date}T${time}:00-05:00`)
  const slotEnd = new Date(slotStart.getTime() + dur * 60000)

  // 5. Pregunta a Google. getGoogleCalendarBusy es fail-open: si el token está
  //    muerto o Google falla, devuelve [] y tratamos el slot como disponible
  //    (no bloqueamos el funnel del staff; el constraint de DB cubre el doble-booking de citas).
  try {
    const busy = await getGoogleCalendarBusy(doctorId, slotStart.toISOString(), slotEnd.toISOString())
    const collides = (busy ?? []).some(b => {
      const bs = new Date(b.start).getTime()
      const be = new Date(b.end).getTime()
      return bs < slotEnd.getTime() && be > slotStart.getTime()
    })
    return new Response(
      JSON.stringify({ available: !collides, reason: collides ? 'google_busy' : null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('[/api/availability/check] google check failed (fail-open):', e)
    return new Response(JSON.stringify({ available: true, reason: null }), { status: 200 })
  }
}
