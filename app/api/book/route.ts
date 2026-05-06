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
      appointment_type_id,
      date,
      time,
      patient_first_name,
      patient_last_name,
      phone,
      email,
      cedula,
      custom_fields,
    } = body as {
      org_slug?: string
      modality?: 'presencial' | 'virtual'
      doctor_id?: string | null
      appointment_type_id?: string | null
      date?: string
      time?: string
      patient_first_name?: string
      patient_last_name?: string
      phone?: string
      email?: string
      cedula?: string
      custom_fields?: Record<string, string>
    }

    if (!org_slug || !date || !time || !patient_first_name || !phone) {
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

    // ── Assign doctor ─────────────────────────────────────────────────────────
    let selectedDoctorId: string | null = doctor_id ?? null

    if (!selectedDoctorId) {
      // 1. Fetch appointment type config (assignment_mode + doctor_ids)
      let assignmentMode = 'round_robin_proportional'
      let typeDoctorIds: string[] = []

      if (appointment_type_id) {
        const { data: apptType } = await supabase
          .from('appointment_types')
          .select('assignment_mode, doctor_ids')
          .eq('id', appointment_type_id)
          .single()
        if (apptType) {
          assignmentMode = (apptType.assignment_mode as string) ?? 'round_robin_proportional'
          typeDoctorIds  = (apptType.doctor_ids as string[]) ?? []
        }
      }

      // 2. Candidate doctor IDs: use type's list or fall back to all active org doctors
      let candidateIds: string[] = typeDoctorIds.length > 0 ? typeDoctorIds : []
      if (candidateIds.length === 0) {
        const { data: allDoctors } = await supabase
          .from('doctors').select('id').eq('organization_id', org.id).eq('is_active', true)
        candidateIds = (allDoctors ?? []).map((d: any) => d.id as string)
      }
      if (candidateIds.length === 0) {
        return jsonResponse({ success: false, error: 'No hay médicos disponibles' }, 400)
      }

      // 3a. Filter to doctors whose recurring schedule covers the requested slot
      // day_of_week in DB: 0=Sun..6=Sat — same as JS getDay() (per CLAUDE.md)
      const dayOfWeek = new Date(date + 'T12:00:00').getDay()
      const { data: schedules } = await supabase
        .from('schedules')
        .select('doctor_id, start_time, end_time')
        .in('doctor_id', candidateIds)
        .eq('day_of_week', dayOfWeek)
        .eq('is_recurring', true)

      const availableIds: string[] = [...new Set(
        (schedules ?? [])
          .filter((s: any) => s.start_time <= time && time < s.end_time)
          .map((s: any) => s.doctor_id as string)
      )]

      if (availableIds.length === 0) {
        return jsonResponse({ success: false, error: 'No hay médicos disponibles para este horario' }, 400)
      }

      if (assignmentMode === 'round_robin_availability') {
        // Pick first doctor that has the slot
        selectedDoctorId = availableIds[0]
      } else {
        // round_robin_proportional: fewest scheduled appointments this month
        const now        = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

        const { data: monthApts } = await supabase
          .from('appointments')
          .select('doctor_id')
          .in('doctor_id', availableIds)
          .gte('scheduled_at', monthStart)
          .lte('scheduled_at', monthEnd)
          .eq('status', 'scheduled')

        const counts: Record<string, number> = Object.fromEntries(availableIds.map(id => [id, 0]))
        ;(monthApts ?? []).forEach((a: any) => { if (counts[a.doctor_id] !== undefined) counts[a.doctor_id]++ })

        const minCount = Math.min(...Object.values(counts))
        const tied     = availableIds.filter(id => counts[id] === minCount)

        if (tied.length === 1) {
          selectedDoctorId = tied[0]
        } else {
          // Tiebreak: fewest appointments in the last 7 days
          const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
          const { data: recentApts } = await supabase
            .from('appointments')
            .select('doctor_id')
            .in('doctor_id', tied)
            .gte('scheduled_at', weekAgo)
            .eq('status', 'scheduled')

          const recent: Record<string, number> = Object.fromEntries(tied.map(id => [id, 0]))
          ;(recentApts ?? []).forEach((a: any) => { if (recent[a.doctor_id] !== undefined) recent[a.doctor_id]++ })

          const minRecent = Math.min(...Object.values(recent))
          selectedDoctorId = tied.find(id => recent[id] === minRecent) ?? tied[0]
        }
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
        contact_name: patient_first_name,
        contact_last_name: patient_last_name || null,
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

    return jsonResponse({ success: true, lead_id: lead.id, appointment_id: appointment.id }, 201)
  } catch (error) {
    console.error('Booking error', error)
    return jsonResponse({ success: false, error: 'Error interno del servidor' }, 500)
  }
}
