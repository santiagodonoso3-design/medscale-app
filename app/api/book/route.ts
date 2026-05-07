import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'
import { bookingConfirmationPatient, bookingNotificationDoctor, bookingNotificationClinic } from '@/lib/email/templates'

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

    console.log('[/api/book] body:', { org_slug, appointment_type_id, doctor_id, date, time, patient_first_name })

    if (!org_slug || !date || !time || !patient_first_name || !phone) {
      return jsonResponse({ success: false, error: 'Faltan campos requeridos' }, 400)
    }

    const supabase = supabasePublic

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, contact_email')
      .eq('slug', org_slug)
      .single()

    if (orgError || !org) {
      console.error('[/api/book] org lookup error:', orgError)
      return jsonResponse({ success: false, error: 'Organización no encontrada' }, 404)
    }

    // ── Assign doctor ─────────────────────────────────────────────────────────
    const bodyDoctorId: string | null = doctor_id ?? null  // original value from request
    let selectedDoctorId: string | null = bodyDoctorId
    let appointmentTypeName: string | null = null
    let appointmentTypePrice: number | null = null
    let assignmentMode = ''

    if (!selectedDoctorId) {
      try {
        // 1. Fetch appointment type config (assignment_mode + doctor_ids)
        assignmentMode = 'round_robin_proportional'
        let typeDoctorIds: string[] = []

        if (appointment_type_id) {
          const { data: apptType, error: typeError } = await supabase
            .from('appointment_types')
            .select('name, price, assignment_mode, doctor_ids')
            .eq('id', appointment_type_id)
            .single()
          if (typeError) {
            console.error('[/api/book] appointment_types fetch error:', typeError)
          } else if (apptType) {
            appointmentTypeName  = (apptType.name  as string) ?? null
            appointmentTypePrice = (apptType.price as number) ?? null
            assignmentMode = (apptType.assignment_mode as string) ?? 'round_robin_proportional'
            typeDoctorIds  = (apptType.doctor_ids as string[]) ?? []
            console.log('[/api/book] type config:', { assignmentMode, typeDoctorIds })
          }
        }

        // 2. Candidate doctor IDs
        let candidateIds: string[] = typeDoctorIds.length > 0 ? typeDoctorIds : []
        if (candidateIds.length === 0) {
          const { data: allDoctors, error: docError } = await supabase
            .from('doctors').select('id').eq('organization_id', org.id).eq('is_active', true)
          if (docError) console.error('[/api/book] doctors fetch error:', docError)
          candidateIds = (allDoctors ?? []).map((d: any) => d.id as string)
        }

        console.log('[/api/book] candidateIds:', candidateIds)

        if (candidateIds.length === 0) {
          return jsonResponse({ success: false, error: 'No hay médicos disponibles' }, 400)
        }

        // 3a. Filter to doctors whose schedule covers the requested slot
        // day_of_week in DB: 0=Sun..6=Sat — same as JS getDay() (per CLAUDE.md)
        const dayOfWeek = new Date(date + 'T12:00:00').getDay()
        console.log('[/api/book] dayOfWeek:', dayOfWeek, 'time:', time)

        const { data: schedules, error: schedError } = await supabase
          .from('schedules')
          .select('doctor_id, start_time, end_time')
          .in('doctor_id', candidateIds)
          .eq('day_of_week', dayOfWeek)

        if (schedError) console.error('[/api/book] schedules fetch error:', schedError)
        console.log('[/api/book] schedules found:', (schedules ?? []).length)

        const availableIds: string[] = [...new Set(
          (schedules ?? [])
            .filter((s: any) => s.start_time <= time && time < s.end_time)
            .map((s: any) => s.doctor_id as string)
        )]

        console.log('[/api/book] availableIds after schedule filter:', availableIds)

        if (availableIds.length === 0) {
          // Fallback: use any candidate instead of refusing the booking
          console.warn('[/api/book] no schedule match — falling back to first candidate')
          selectedDoctorId = candidateIds[0]
        } else if (assignmentMode === 'round_robin_availability') {
          selectedDoctorId = availableIds[0]
        } else {
          // round_robin_proportional: fewest scheduled appointments this month
          const now        = new Date()
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
          const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

          const { data: monthApts, error: monthErr } = await supabase
            .from('appointments')
            .select('doctor_id')
            .in('doctor_id', availableIds)
            .gte('scheduled_at', monthStart)
            .lte('scheduled_at', monthEnd)
            .eq('status', 'scheduled')

          if (monthErr) console.error('[/api/book] monthly appointments fetch error:', monthErr)

          const counts: Record<string, number> = Object.fromEntries(availableIds.map(id => [id, 0]))
          ;(monthApts ?? []).forEach((a: any) => { if (counts[a.doctor_id] !== undefined) counts[a.doctor_id]++ })

          const minCount = Math.min(...Object.values(counts))
          const tied     = availableIds.filter(id => counts[id] === minCount)

          if (tied.length === 1) {
            selectedDoctorId = tied[0]
          } else {
            const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
            const { data: recentApts, error: recentErr } = await supabase
              .from('appointments')
              .select('doctor_id')
              .in('doctor_id', tied)
              .gte('scheduled_at', weekAgo)
              .eq('status', 'scheduled')

            if (recentErr) console.error('[/api/book] recent appointments fetch error:', recentErr)

            const recent: Record<string, number> = Object.fromEntries(tied.map(id => [id, 0]))
            ;(recentApts ?? []).forEach((a: any) => { if (recent[a.doctor_id] !== undefined) recent[a.doctor_id]++ })

            const minRecent = Math.min(...Object.values(recent))
            selectedDoctorId = tied.find(id => recent[id] === minRecent) ?? tied[0]
          }
        }
      } catch (rrError) {
        // Round-robin logic failed — fall back to first active doctor
        console.error('[/api/book] round-robin error, falling back:', rrError)
        const { data: fallbackDoctors } = await supabase
          .from('doctors').select('id').eq('organization_id', org.id).eq('is_active', true).limit(1)
        selectedDoctorId = fallbackDoctors?.[0]?.id ?? null
        if (!selectedDoctorId) {
          return jsonResponse({ success: false, error: 'No hay médicos disponibles' }, 400)
        }
      }
    }

    // If doctor came from body and assignmentMode not yet resolved, fetch it now
    if (bodyDoctorId && !assignmentMode && appointment_type_id) {
      const { data: typeData } = await supabase
        .from('appointment_types')
        .select('assignment_mode')
        .eq('id', appointment_type_id)
        .single()
      assignmentMode = typeData?.assignment_mode ?? ''
    }

    // Determine assignment type: patient chose explicitly vs system auto-assigned
    const doctorAssignmentType: 'patient_choice' | 'auto_assigned' =
      bodyDoctorId && (assignmentMode === 'one_on_one' || assignmentMode === 'hybrid')
        ? 'patient_choice'
        : 'auto_assigned'

    console.log('[/api/book] selectedDoctorId:', selectedDoctorId, 'assignment:', doctorAssignmentType)

    // Get location + doctor metadata in parallel
    const [{ data: locations, error: locError }, { data: doctorData, error: docMetaError }] = await Promise.all([
      supabase.from('locations').select('id, address, city').eq('organization_id', org.id).limit(1),
      supabase.from('doctors').select('metadata').eq('id', selectedDoctorId!).single(),
    ])

    if (locError) console.error('[/api/book] locations fetch error:', locError)
    if (docMetaError) console.error('[/api/book] doctor metadata fetch error:', docMetaError)

    if (!locations || locations.length === 0) {
      return jsonResponse({ success: false, error: 'No hay sedes disponibles' }, 400)
    }

    const locationId = locations[0].id
    const doctorMeta = doctorData?.metadata as { duration?: number; default_duration?: number } | null
    const duration = Number(doctorMeta?.duration || doctorMeta?.default_duration || 30)

    // Create lead
    const leadNotes = custom_fields
      ? `Cédula: ${cedula}\n${Object.entries(custom_fields).map(([k, v]) => `${k}: ${v}`).join('\n')}`
      : `Cédula: ${cedula}`

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
        status: 'cita_valoracion_agendada',
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      console.error('[/api/book] lead insert error:', leadError)
      return jsonResponse({ success: false, error: leadError?.message || 'Error creando lead' }, 500)
    }

    // Create appointment
    const scheduledAt = new Date(`${date}T${time}:00.000Z`)
    const endDate     = new Date(scheduledAt.getTime() + duration * 60000)

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
        doctor_assignment_type: doctorAssignmentType,
      })
      .select('id, manage_token')
      .single()

    if (appointmentError || !appointment) {
      console.error('[/api/book] appointment insert error:', appointmentError)
      return jsonResponse({ success: false, error: appointmentError?.message || 'Error creando cita' }, 500)
    }

    console.log('[/api/book] success — lead:', lead.id, 'appointment:', appointment.id)
    const manageUrl = (appointment as any).manage_token
      ? `https://app.medscale.app/appointment/${(appointment as any).manage_token}/manage`
      : undefined

    // ── Send confirmation emails (fire-and-forget) ────────────────────────────
    if (process.env.RESEND_API_KEY) {
      const formattedDate = new Intl.DateTimeFormat('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'America/Bogota',
      }).format(new Date(`${date}T${time}:00`))

      const orgNameDisplay = (org as any).name ?? org_slug
      const doctorName     = doctorData?.metadata
        ? String((doctorData.metadata as any).name ?? '')
        : null
      const language = (body as any).language ?? 'es'

      const emailParams = {
        patientName:         `${patient_first_name}${patient_last_name ? ' ' + patient_last_name : ''}`,
        doctorName:          doctorName || null,
        date:                formattedDate,
        time,
        modality:            modality ?? 'presencial',
        orgName:             orgNameDisplay,
        appointmentTypeName,
        price:               appointmentTypePrice,
        locationAddress:     ((locations[0] as any)?.address as string | null) ?? null,
        locationCity:        ((locations[0] as any)?.city    as string | null) ?? null,
        language,
        manageUrl,
      }

      if (email) {
        console.log('[email] attempting to send to:', email)
        const results = await Promise.allSettled([
          resend.emails.send({
            from:    'citas@medscale.app',
            to:      email,
            subject: `Cita confirmada — ${orgNameDisplay}`,
            html:    bookingConfirmationPatient(emailParams),
          }),
        ])
        console.log('[email] results:', JSON.stringify(results))
        results.forEach(r => { if (r.status === 'rejected') console.error('[email] failed:', r.reason) })
      }

      const clinicEmail = (org as any).contact_email as string | null
      if (clinicEmail) {
        Promise.allSettled([
          resend.emails.send({
            from:    'citas@medscale.app',
            to:      clinicEmail,
            subject: `Nueva cita — ${patient_first_name}${patient_last_name ? ' ' + patient_last_name : ''} · ${formattedDate}`,
            html:    bookingNotificationClinic({
              patientName:         `${patient_first_name}${patient_last_name ? ' ' + patient_last_name : ''}`,
              patientPhone:        phone ?? '',
              patientEmail:        email ?? null,
              doctorName:          doctorName || null,
              date:                formattedDate,
              time,
              modality:            modality ?? 'presencial',
              orgName:             orgNameDisplay,
              appointmentTypeName,
            }),
          }),
        ]).then(results => {
          results.forEach(r => { if (r.status === 'rejected') console.error('[email:clinic] failed:', r.reason) })
        })
      }
    }

    return jsonResponse({ success: true, lead_id: lead.id, appointment_id: appointment.id }, 201)
  } catch (error) {
    console.error('[/api/book] unhandled error:', error)
    return jsonResponse({ success: false, error: 'Error interno del servidor' }, 500)
  }
}
