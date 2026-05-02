import { createClient } from '@supabase/supabase-js'

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      modality,
      doctor_id,
      date,
      time,
      patient_name,
      phone,
      email,
      cedula,
      custom_fields,
    } = body as {
      org_slug?: string
      modality?: 'presencial' | 'virtual'
      doctor_id?: string | null
      date?: string
      time?: string
      patient_name?: string
      phone?: string
      email?: string
      cedula?: string
      custom_fields?: Record<string, string>
    }

    if (!org_slug || !date || !time || !patient_name || !phone) {
      return jsonResponse({ success: false, error: 'Faltan campos requeridos' }, 400)
    }

    const supabase = supabasePublic

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', org_slug)
      .single()

    if (orgError || !org) {
      return jsonResponse({ success: false, error: 'Organización no encontrada' }, 404)
    }

    // Handle round-robin if no doctor selected
    let selectedDoctorId = doctor_id
    if (!selectedDoctorId) {
      // Simple round-robin: select first available doctor
      const { data: availableDoctors } = await supabase
        .from('doctors')
        .select('id')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .limit(1)

      if (availableDoctors && availableDoctors.length > 0) {
        selectedDoctorId = availableDoctors[0].id
      } else {
        return jsonResponse({ success: false, error: 'No hay médicos disponibles' }, 400)
      }
    }

    // Get location + doctor metadata in parallel
    const [{ data: locations }, { data: doctorData }] = await Promise.all([
      supabase.from('locations').select('id').eq('organization_id', org.id).limit(1),
      supabase.from('doctors').select('metadata').eq('id', selectedDoctorId!).single(),
    ])

    if (!locations || locations.length === 0) {
      return jsonResponse({ success: false, error: 'No hay sedes disponibles' }, 400)
    }

    const locationId = locations[0].id
    const doctorMeta = doctorData?.metadata as { duration?: number; default_duration?: number } | null
    const duration = Number(doctorMeta?.duration || doctorMeta?.default_duration || 30)

    // Create lead
    const leadNotes = custom_fields ? `Cédula: ${cedula}\n${Object.entries(custom_fields).map(([k, v]) => `${k}: ${v}`).join('\n')}` : `Cédula: ${cedula}`

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: org.id,
        contact_name: patient_name,
        contact_phone: phone,
        contact_email: email || null,
        source: 'book',
        notes: leadNotes,
        status: 'new',
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      console.error('[/api/book] lead insert error:', leadError)
      return jsonResponse({ success: false, error: leadError?.message || 'Error creando lead' }, 500)
    }

    // Create appointment — scheduled_at uses UTC; local slot times are treated as UTC
    const scheduledAt = new Date(`${date}T${time}:00.000Z`)
    const endDate = new Date(scheduledAt.getTime() + duration * 60000)

    console.log('[/api/book] inserting appointment:', {
      org_id: org.id,
      doctor_id: selectedDoctorId,
      location_id: locationId,
      scheduled_at: scheduledAt.toISOString(),
    })

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        organization_id: org.id,
        doctor_id: selectedDoctorId,
        location_id: locationId,
        lead_id: lead.id,
        scheduled_at: scheduledAt.toISOString(),
        ends_at: endDate.toISOString(),
        status: 'scheduled',
        notes: modality === 'virtual' ? 'Consulta virtual' : 'Consulta presencial',
        external_calendar_id: null,
      })
      .select('id')
      .single()

    if (appointmentError || !appointment) {
      console.error('[/api/book] appointment insert error:', appointmentError)
      return jsonResponse({ success: false, error: appointmentError?.message || 'Error creando cita' }, 500)
    }

    console.log('[/api/book] success — lead:', lead.id, 'appointment:', appointment.id)
    return jsonResponse({ success: true, lead_id: lead.id, appointment_id: appointment.id }, 201)
  } catch (error) {
    console.error('Booking error', error)
    return jsonResponse({ success: false, error: 'Error interno del servidor' }, 500)
  }
}
