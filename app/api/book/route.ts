import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'
import { bookingConfirmationPatient, bookingNotificationDoctor, bookingNotificationClinic } from '@/lib/email/templates'
import { createGoogleCalendarEvent, getGoogleCalendarBusy } from '@/lib/google/calendar'
import { logAppointmentEvent } from '@/lib/appointments/log-event'

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
      .select('id, name, contact_email')
      .eq('slug', org_slug)
      .single()

    if (orgError || !org) {
      console.error('[/api/book] org lookup error:', orgError)
      return jsonResponse({ success: false, error: 'Organización no encontrada' }, 404)
    }

    // ── Coherencia cross-tenant: los IDs del body deben pertenecer a la org ──────
    // La ruta es pública (sin sesión). org.id se deriva del org_slug, y todo ID que
    // venga del cliente (doctor_id, appointment_type_id) se valida contra ESE org.id
    // ANTES de usarse, para que un atacante no inyecte una cita ni dispare un evento
    // de calendario apuntando a un doctor o tipo de cita de OTRA organización.
    if (doctor_id) {
      const { data: validDoctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', doctor_id)
        .eq('organization_id', org.id)
        .maybeSingle()
      if (!validDoctor) {
        return jsonResponse({ success: false, error: 'Médico no válido para esta organización' }, 400)
      }
    }

    if (appointment_type_id) {
      const { data: validType } = await supabase
        .from('appointment_types')
        .select('id')
        .eq('id', appointment_type_id)
        .eq('organization_id', org.id)
        .maybeSingle()
      if (!validType) {
        return jsonResponse({ success: false, error: 'Tipo de cita no válido para esta organización' }, 400)
      }
    }

    // ── Enforce booking notice window (min/max) ──────────────────────────
    if (appointment_type_id) {
      const { data: noticeType, error: noticeErr } = await supabase
        .from('appointment_types')
        .select('min_notice_hours, max_notice_days')
        .eq('id', appointment_type_id)
        .single()

      if (noticeErr) {
        console.error('[/api/book] notice window fetch error:', noticeErr)
      } else if (noticeType) {
        const requestedAt = new Date(`${date}T${time}:00-05:00`)
        const now = new Date()

        const minHours = noticeType.min_notice_hours ?? 0
        if (minHours > 0 && requestedAt < new Date(now.getTime() + minHours * 3600 * 1000)) {
          return jsonResponse(
            { success: false, error: `Esta cita requiere agendarse con al menos ${minHours} horas de anticipación.` },
            400
          )
        }

        const maxDays = noticeType.max_notice_days ?? 0
        if (maxDays > 0 && requestedAt > new Date(now.getTime() + maxDays * 24 * 3600 * 1000)) {
          return jsonResponse(
            { success: false, error: `Esta cita no puede agendarse con más de ${maxDays} días de anticipación.` },
            400
          )
        }
      }
    }

    // ── Assign doctor ─────────────────────────────────────────────────────────
    const bodyDoctorId: string | null = doctor_id ?? null  // original value from request
    let selectedDoctorId: string | null = bodyDoctorId
    let appointmentTypeName: string | null = null
    let appointmentTypePrice: number | null = null
    let appointmentTypeDuration: number | null = null
    let assignmentMode = ''
    let rrCountAll = true

    if (!selectedDoctorId) {
      try {
        // 1. Fetch appointment type config (assignment_mode + doctor_ids)
        assignmentMode = 'round_robin_proportional'
        let typeDoctorIds: string[] = []

        if (appointment_type_id) {
          const { data: apptType, error: typeError } = await supabase
            .from('appointment_types')
            .select('name, price_presencial, price_virtual, assignment_mode, doctor_ids, rr_count_all, duration_minutes')
            .eq('id', appointment_type_id)
            .single()
          if (typeError) {
            console.error('[/api/book] appointment_types fetch error:', typeError)
          } else if (apptType) {
            appointmentTypeName     = (apptType.name  as string) ?? null
            appointmentTypePrice    = modality === 'virtual'
              ? ((apptType.price_virtual    as number) ?? null)
              : ((apptType.price_presencial as number) ?? null)
            appointmentTypeDuration = (apptType.duration_minutes as number) ?? null
            assignmentMode = (apptType.assignment_mode as string) ?? 'round_robin_proportional'
            typeDoctorIds  = (apptType.doctor_ids as string[]) ?? []
            rrCountAll     = (apptType.rr_count_all ?? true) as boolean
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


        if (candidateIds.length === 0) {
          return jsonResponse({ success: false, error: 'No hay médicos disponibles' }, 400)
        }

        // 3a. Filter to doctors whose schedule covers the requested slot
        // day_of_week in DB: 0=Sun..6=Sat — same as JS getDay() (per CLAUDE.md)
        const dayOfWeek = new Date(date + 'T12:00:00').getDay()

        const { data: schedules, error: schedError } = await supabase
          .from('schedules')
          .select('doctor_id, start_time, end_time')
          .in('doctor_id', candidateIds)
          .eq('day_of_week', dayOfWeek)

        if (schedError) console.error('[/api/book] schedules fetch error:', schedError)

        const availableIds: string[] = [...new Set(
          (schedules ?? [])
            .filter((s: any) => s.start_time <= time && time < s.end_time)
            .map((s: any) => s.doctor_id as string)
        )]


        if (availableIds.length === 0) {
          return jsonResponse({ success: false, error: 'No hay disponibilidad para ese horario.' }, 400)
        } else if (assignmentMode === 'round_robin_availability') {
          selectedDoctorId = availableIds[0]
        } else {
          // round_robin_proportional: fewest scheduled appointments this month
          const now        = new Date()
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
          const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

          let monthQuery = supabase
            .from('appointments')
            .select('doctor_id')
            .in('doctor_id', availableIds)
            .gte('scheduled_at', monthStart)
            .lte('scheduled_at', monthEnd)
            .eq('status', 'scheduled')
          if (!rrCountAll) monthQuery = (monthQuery as any).eq('doctor_assignment_type', 'auto_assigned')
          const { data: monthApts, error: monthErr } = await monthQuery

          if (monthErr) console.error('[/api/book] monthly appointments fetch error:', monthErr)

          const counts: Record<string, number> = Object.fromEntries(availableIds.map(id => [id, 0]))
          ;(monthApts ?? []).forEach((a: any) => { if (counts[a.doctor_id] !== undefined) counts[a.doctor_id]++ })

          const minCount = Math.min(...Object.values(counts))
          const tied     = availableIds.filter(id => counts[id] === minCount)

          if (tied.length === 1) {
            selectedDoctorId = tied[0]
          } else {
            const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
            let recentQuery = supabase
              .from('appointments')
              .select('doctor_id')
              .in('doctor_id', tied)
              .gte('scheduled_at', weekAgo)
              .eq('status', 'scheduled')
            if (!rrCountAll) recentQuery = (recentQuery as any).eq('doctor_assignment_type', 'auto_assigned')
            const { data: recentApts, error: recentErr } = await recentQuery

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
        .select('assignment_mode, duration_minutes, price_presencial, price_virtual')
        .eq('id', appointment_type_id)
        .single()
      assignmentMode          = typeData?.assignment_mode ?? ''
      appointmentTypeDuration = (typeData?.duration_minutes as number) ?? null
      appointmentTypePrice    = modality === 'virtual'
        ? ((typeData?.price_virtual    as number) ?? null)
        : ((typeData?.price_presencial as number) ?? null)
    }

    // Determine assignment type: patient chose explicitly vs system auto-assigned
    const doctorAssignmentType: 'patient_choice' | 'auto_assigned' =
      bodyDoctorId && (assignmentMode === 'one_on_one' || assignmentMode === 'hybrid')
        ? 'patient_choice'
        : 'auto_assigned'


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
    const duration = appointmentTypeDuration ?? 30

    // ── Collision check before creating the lead ──────────────────────────────
    const slotStart = new Date(`${date}T${time}:00-05:00`)
    const slotEnd   = new Date(slotStart.getTime() + duration * 60000)

    // (a) Colisión con otra cita activa del mismo doctor (solapamiento real)
    const { data: dbConflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', selectedDoctorId)
      .eq('status', 'scheduled')
      .lt('scheduled_at', slotEnd.toISOString())
      .gt('ends_at', slotStart.toISOString())
      .limit(1)
    if (dbConflicts && dbConflicts.length > 0) {
      return jsonResponse({ success: false, error: 'Ese horario ya no está disponible.' }, 409)
    }

    // (b) Colisión con bloqueo del Google Calendar del doctor.
    //     Fail-open SOLO si la lectura de Google falla (token muerto / error API):
    //     se loguea y se permite, para no tumbar todo el funnel por un error transitorio.
    try {
      const gbusy = await getGoogleCalendarBusy(
        selectedDoctorId!,
        slotStart.toISOString(),
        slotEnd.toISOString()
      )
      const collides = (gbusy ?? []).some(b => {
        const bs = new Date(b.start).getTime()
        const be = new Date(b.end).getTime()
        return bs < slotEnd.getTime() && be > slotStart.getTime()
      })
      if (collides) {
        return jsonResponse({ success: false, error: 'Ese horario ya no está disponible.' }, 409)
      }
    } catch (e) {
      console.error('[/api/book] google busy check failed (fail-open):', selectedDoctorId, e)
    }

    // Create lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: org.id,
        contact_name: patient_first_name,
        contact_last_name: patient_last_name || null,
        contact_phone: phone,
        contact_email: email || null,
        contact_cedula: cedula || null,
        source: 'book',
        notes: null,
        metadata: custom_fields && Object.keys(custom_fields).length > 0 ? custom_fields : null,
        status: 'cita_valoracion_agendada',
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      console.error('[/api/book] lead insert error:', leadError)
      return jsonResponse({ success: false, error: leadError?.message || 'Error creando lead' }, 500)
    }

    // Create appointment
    const scheduledAt = new Date(`${date}T${time}:00-05:00`)
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
        appointment_type_id: appointment_type_id ?? null,
        modality: modality ?? null,
        price: appointmentTypePrice ?? null,
      })
      .select('id, manage_token')
      .single()

    if (appointmentError || !appointment) {
      console.error('[/api/book] appointment insert error:', appointmentError)
      return jsonResponse({ success: false, error: appointmentError?.message || 'Error creando cita' }, 500)
    }

    await logAppointmentEvent({
      appointmentId: appointment.id,
      eventType: 'created',
      actorType: 'patient',
      note: 'Cita agendada por el paciente',
      metadata: { modality: modality ?? 'presencial', source: 'book' },
    })

    // ── Create Google Calendar event (non-blocking) ───────────────────────────
    if (selectedDoctorId) {
      Promise.allSettled([
        createGoogleCalendarEvent({
          doctorId:      selectedDoctorId,
          summary:       `Cita — ${patient_first_name}${patient_last_name ? ' ' + patient_last_name : ''}`,
          description:   `Paciente: ${patient_first_name}${patient_last_name ? ' ' + patient_last_name : ''}\nTeléfono: ${phone}\nModalidad: ${modality ?? 'presencial'}`,
          startIso:      scheduledAt.toISOString(),
          endsIso:       endDate.toISOString(),
          attendeeEmail: email ?? null,
        }).then(async eventId => {
          if (eventId) {
            await supabase.from('appointments')
              .update({ external_calendar_id: eventId })
              .eq('id', appointment.id)
            await logAppointmentEvent({
              appointmentId: appointment.id,
              eventType: 'calendar_event_created',
              actorType: 'system',
              note: 'Evento agregado al Google Calendar del médico',
              metadata: { calendar_event_id: eventId },
            })
          } else {
            await logAppointmentEvent({
              appointmentId: appointment.id,
              eventType: 'calendar_failed',
              actorType: 'system',
              note: 'No se pudo crear el evento en Google Calendar',
            })
          }
        }),
      ]).catch(() => {})
    }

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
        const results = await Promise.allSettled([
          resend.emails.send({
            from:    'citas@medscale.app',
            to:      email,
            subject: `Cita confirmada — ${orgNameDisplay}`,
            html:    bookingConfirmationPatient(emailParams),
          }),
        ])
        results.forEach(r => { if (r.status === 'rejected') console.error('[email] failed:', r.reason) })
        const patientEmailOk = results.every(r => r.status === 'fulfilled')
        await logAppointmentEvent({
          appointmentId: appointment.id,
          eventType: patientEmailOk ? 'email_patient_sent' : 'email_failed',
          actorType: 'system',
          note: patientEmailOk ? `Correo de confirmación enviado a ${email}` : `Falló el envío del correo al paciente (${email})`,
          metadata: { channel: 'email', email_to: email, recipient: 'patient' },
        })
      }

      // Build field_name → field_label map for readable custom field keys
      let fieldLabelMap: Record<string, string> = {}
      if (appointment_type_id && custom_fields && Object.keys(custom_fields).length > 0) {
        const { data: formFieldDefs } = await supabase
          .from('appointment_form_fields')
          .select('field_name, field_label')
          .eq('appointment_type_id', appointment_type_id)
          .eq('active', true)
        fieldLabelMap = Object.fromEntries(
          (formFieldDefs ?? []).map((f: any) => [f.field_name, f.field_label || f.field_name])
        )
      }

      const clinicEmail = (org as any).contact_email as string | null
      const clinicEmailList = clinicEmail
        ? clinicEmail.split(',').map((e: string) => e.trim()).filter(Boolean)
        : []
      if (clinicEmailList.length > 0) {
        const clinicResults = await Promise.allSettled([
          resend.emails.send({
            from:    'citas@medscale.app',
            to:      clinicEmailList,
            subject: `Nueva cita — ${patient_first_name}${patient_last_name ? ' ' + patient_last_name : ''} · ${formattedDate}`,
            html:    bookingNotificationClinic({
              patientName:         `${patient_first_name}${patient_last_name ? ' ' + patient_last_name : ''}`,
              patientPhone:        phone ?? '',
              patientEmail:        email ?? null,
              patientCedula:       cedula ?? null,
              doctorName:          doctorName || null,
              date:                formattedDate,
              time,
              modality:            modality ?? 'presencial',
              orgName:             orgNameDisplay,
              appointmentTypeName,
              customFields:        custom_fields
                ? Object.fromEntries(Object.entries(custom_fields).map(([k, v]) => [fieldLabelMap[k] || k, v]))
                : null,
            }),
          }),
        ])
        clinicResults.forEach(r => { if (r.status === 'rejected') console.error('[email:clinic] failed:', r.reason) })
        const clinicEmailOk = clinicResults.every(r => r.status === 'fulfilled')
        await logAppointmentEvent({
          appointmentId: appointment.id,
          eventType: clinicEmailOk ? 'email_clinic_sent' : 'email_failed',
          actorType: 'system',
          note: clinicEmailOk ? `Notificación enviada a la clínica (${clinicEmailList.join(', ')})` : 'Falló el envío de la notificación a la clínica',
          metadata: { channel: 'email', email_to: clinicEmailList, recipient: 'clinic' },
        })
      }
    }

    return jsonResponse({ success: true, lead_id: lead.id, appointment_id: appointment.id }, 201)
  } catch (error) {
    console.error('[/api/book] unhandled error:', error)
    return jsonResponse({ success: false, error: 'Error interno del servidor' }, 500)
  }
}
