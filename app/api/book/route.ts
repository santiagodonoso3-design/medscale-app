import { createServiceClient } from '@/lib/supabase/server'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      org_slug,
      doctor_id,
      location_id,
      patient_name,
      phone,
      email,
      notes,
      scheduled_at,
      duration_minutes,
    } = body as {
      org_slug?: string
      doctor_id?: string
      location_id?: string
      patient_name?: string
      phone?: string
      email?: string
      notes?: string
      scheduled_at?: string
      duration_minutes?: number
    }

    if (!org_slug || !doctor_id || !location_id || !patient_name || !phone || !scheduled_at) {
      return jsonResponse({ success: false, error: 'Faltan campos requeridos' }, 400)
    }

    const supabase = await createServiceClient()

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', org_slug)
      .single()

    if (orgError || !org) {
      return jsonResponse({ success: false, error: 'Organización no encontrada' }, 404)
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: org.id,
        contact_name: patient_name,
        contact_phone: phone,
        contact_email: email || null,
        source: 'book',
        notes: notes || null,
        status: 'new',
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      return jsonResponse({ success: false, error: leadError?.message || 'Error creando lead' }, 500)
    }

    const startDate = new Date(scheduled_at)
    const duration = duration_minutes || 30
    const endDate = new Date(startDate.getTime() + duration * 60000)

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        organization_id: org.id,
        doctor_id,
        location_id,
        lead_id: lead.id,
        scheduled_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        status: 'scheduled',
        notes: notes || null,
      })
      .select('id')
      .single()

    if (appointmentError || !appointment) {
      return jsonResponse({ success: false, error: appointmentError?.message || 'Error creando cita' }, 500)
    }

    return jsonResponse({ success: true, lead_id: lead.id, appointment_id: appointment.id }, 201)
  } catch (error) {
    console.error('Booking error', error)
    return jsonResponse({ success: false, error: 'Error interno del servidor' }, 500)
  }
}
