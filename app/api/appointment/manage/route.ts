import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'
import { cancellationEmail, rescheduleEmail } from '@/lib/email/templates'
import { logAppointmentEvent } from '@/lib/appointments/log-event'
import { updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from '@/lib/google/calendar'
import { getAppUrl } from '@/lib/config/urls'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function PATCH(request: Request) {
  try {
    const { token, action, new_date, new_time, cancel_reason } = await request.json()

    if (!token || !action) return json({ success: false, error: 'Faltan parámetros' }, 400)

    const { data: apt, error: fetchErr } = await admin
      .from('appointments')
      .select(`
        id, lead_id, doctor_id, appointment_type_id, external_calendar_id, scheduled_at, ends_at, status, notes, manage_token, organization_id,
        doctor:doctor_id(metadata),
        lead:lead_id(contact_name, contact_last_name, contact_email),
        org:organization_id(name, slug)
      `)
      .eq('manage_token', token)
      .single()

    if (fetchErr || !apt) return json({ success: false, error: 'Cita no encontrada' }, 404)
    if (apt.status === 'cancelled') return json({ success: false, error: 'La cita ya fue cancelada' }, 400)

    const { data: orgData } = await admin
      .from('organizations')
      .select('contact_email, logo_url, primary_color')
      .eq('id', apt.organization_id)
      .single()

    const lead     = Array.isArray(apt.lead)   ? apt.lead[0]   : apt.lead
    const org      = Array.isArray(apt.org)    ? apt.org[0]    : apt.org
    const doctor   = Array.isArray(apt.doctor) ? apt.doctor[0] : apt.doctor
    const orgName     = (org as any)?.name ?? ''
    const orgSlug     = (org as any)?.slug ?? ''
    const clinicEmail = orgData?.contact_email as string | null
    const brand = {
      logoUrl:      ((orgData as any)?.logo_url      as string | null) ?? null,
      primaryColor: ((orgData as any)?.primary_color as string | null) ?? null,
    }
    const patientEmail = lead?.contact_email
    const patientName  = [lead?.contact_name, lead?.contact_last_name].filter(Boolean).join(' ') || 'Paciente'
    const doctorName   = doctor?.metadata ? String((doctor.metadata as any).name ?? '') : null

    const fmtDate = (iso: string) =>
      new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(iso))
    const fmtTime = (iso: string) =>
      new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso))

    if (action === 'reschedule') {
      if (!new_date || !new_time) return json({ success: false, error: 'Fecha y hora requeridas' }, 400)

      const newScheduledAt = new Date(`${new_date}T${new_time}:00-05:00`)
      const originalDuration = apt.ends_at
        ? new Date(apt.ends_at).getTime() - new Date(apt.scheduled_at).getTime()
        : 30 * 60000
      const newEndsAt = new Date(newScheduledAt.getTime() + originalDuration)

      // 3a. Min-notice
      let minHours = 24
      if ((apt as any).appointment_type_id) {
        const { data: aptType } = await admin
          .from('appointment_types')
          .select('min_notice_hours')
          .eq('id', (apt as any).appointment_type_id)
          .single()
        if (aptType?.min_notice_hours != null) minHours = aptType.min_notice_hours
      }
      if (newScheduledAt.getTime() < Date.now() + minHours * 3600 * 1000) {
        return json({ success: false, error: `Debes reagendar con al menos ${minHours} horas de anticipación.` }, 400)
      }

      // 3b. Doctor schedule window
      const dow = new Date(`${new_date}T12:00:00`).getDay()
      const originalDurationMinutes = Math.round(originalDuration / 60000)
      const [startHour, startMin] = new_time.split(':').map(Number)
      const endTotalMinutes = startHour * 60 + startMin + originalDurationMinutes
      const endHour = Math.floor(endTotalMinutes / 60) % 24
      const endMin = endTotalMinutes % 60
      const endLocalStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`

      const { data: scheduleRows } = await admin
        .from('schedules')
        .select('start_time, end_time')
        .eq('doctor_id', (apt as any).doctor_id)
        .eq('active', true)
        .or(`and(is_recurring.eq.true,day_of_week.eq.${dow}),specific_date.eq.${new_date}`)

      const withinWindow = (scheduleRows ?? []).some(
        (s: any) => s.start_time <= new_time && s.end_time >= endLocalStr
      )
      if (!withinWindow) {
        return json({ success: false, error: 'El horario seleccionado no está disponible para este médico.' }, 409)
      }

      // 3c. Collision check (ignores rows with null ends_at via SQL semantics)
      const { data: conflicts } = await admin
        .from('appointments')
        .select('id')
        .eq('doctor_id', (apt as any).doctor_id)
        .not('status', 'in', '(cancelled,canceled,no_show)')
        .neq('id', apt.id)
        .lt('scheduled_at', newEndsAt.toISOString())
        .gt('ends_at', newScheduledAt.toISOString())

      if (conflicts && conflicts.length > 0) {
        return json({ success: false, error: 'Ese horario acaba de ocuparse. Elige otro.' }, 409)
      }

      const { error: updErr } = await admin
        .from('appointments')
        .update({ scheduled_at: newScheduledAt.toISOString(), ends_at: newEndsAt.toISOString(), status: 'scheduled' })
        .eq('id', apt.id)
      if (updErr) return json({ success: false, error: updErr.message }, 500)

      let calendarMoved: boolean | null = null
      if ((apt as any).external_calendar_id) {
        calendarMoved = await updateGoogleCalendarEvent(
          (apt as any).doctor_id,
          (apt as any).external_calendar_id,
          newScheduledAt.toISOString(),
          newEndsAt.toISOString()
        )
      }

      await logAppointmentEvent({
        appointmentId: apt.id,
        eventType: 'rescheduled',
        actorType: 'patient',
        note: 'Reagendado por el paciente',
        metadata: { calendar_moved: calendarMoved },
      })

      if (patientEmail && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'citas@medscale.app',
          to:   patientEmail,
          subject: `Cita reagendada — ${orgName}`,
          html: rescheduleEmail({
            patientName, orgName, appointmentTypeName: null,
            newDate: fmtDate(newScheduledAt.toISOString()),
            newTime: fmtTime(newScheduledAt.toISOString()),
          }, brand),
        }).catch(err => console.error('[manage] reschedule email error:', err))
      }

      if (clinicEmail && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'citas@medscale.app',
          to: clinicEmail,
          subject: `Cita reagendada — ${patientName} · ${fmtDate(newScheduledAt.toISOString())}`,
          html: rescheduleEmail({
            patientName, orgName, appointmentTypeName: null,
            newDate: fmtDate(newScheduledAt.toISOString()),
            newTime: fmtTime(newScheduledAt.toISOString()),
          }, brand),
        }).catch(err => console.error('[manage] reschedule clinic email error:', err))
      }

      return json({ success: true, scheduled_at: newScheduledAt.toISOString() })
    }

    if (action === 'cancel') {
      if (!cancel_reason || cancel_reason.trim().length < 10)
        return json({ success: false, error: 'Motivo de cancelación requerido (mínimo 10 caracteres)' }, 400)

      const { error: updErr } = await admin
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', apt.id)
      if (updErr) return json({ success: false, error: updErr.message }, 500)

      let calendarDeleted: boolean | null = null
      if ((apt as any).external_calendar_id) {
        calendarDeleted = await deleteGoogleCalendarEvent(
          (apt as any).doctor_id,
          (apt as any).external_calendar_id
        )
        if (calendarDeleted) {
          await admin
            .from('appointments')
            .update({ external_calendar_id: null })
            .eq('id', apt.id)
        }
      }

      const cancelLeadId = (apt as any).lead_id
      if (cancelLeadId) {
        await admin.from('leads').update({ status: 'cancelo_cita' }).eq('id', cancelLeadId)
      }

      await logAppointmentEvent({
        appointmentId: apt.id,
        eventType: 'cancelled',
        actorType: 'patient',
        note: cancel_reason.trim(),
        metadata: { calendar_deleted: calendarDeleted },
      })

      const feedbackUrl = apt.manage_token ? `${getAppUrl(request)}/appointment/${apt.manage_token}/feedback` : undefined
      const bookingUrl  = orgSlug ? `${getAppUrl(request)}/book/${orgSlug}` : undefined

      if (patientEmail && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'citas@medscale.app',
          to:   patientEmail,
          subject: `Cita cancelada — ${orgName}`,
          html: cancellationEmail({
            patientName, orgName, appointmentTypeName: null,
            date: fmtDate(apt.scheduled_at),
            time: fmtTime(apt.scheduled_at),
            feedbackUrl,
            bookingUrl,
          }, brand),
        }).catch(err => console.error('[manage] cancel email error:', err))
      }

      if (clinicEmail && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'citas@medscale.app',
          to: clinicEmail,
          subject: `Cita cancelada — ${patientName}`,
          html: cancellationEmail({
            patientName, orgName, appointmentTypeName: null,
            date: fmtDate(apt.scheduled_at),
            time: fmtTime(apt.scheduled_at),
          }, brand),
        }).catch(err => console.error('[manage] cancel clinic email error:', err))
      }

      return json({ success: true })
    }

    return json({ success: false, error: 'Acción no válida' }, 400)
  } catch (err) {
    console.error('[/api/appointment/manage] error:', err)
    return json({ success: false, error: 'Error interno' }, 500)
  }
}
