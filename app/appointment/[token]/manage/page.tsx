import { createClient } from '@supabase/supabase-js'
import { ManageAppointmentClient } from './ManageAppointmentClient'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface PageProps {
  params: { token: string }
}

export default async function ManagePage({ params }: PageProps) {
  const resolvedParams = await params
  const token = resolvedParams.token

  const { data: apt } = await supabaseAdmin
    .from('appointments')
    .select(`
      id, scheduled_at, ends_at, status, notes, manage_token,
      doctor:doctor_id(id, metadata),
      lead:lead_id(contact_name, contact_last_name, contact_email),
      organization:organization_id(name, slug),
      location:location_id(name, address)
    `)
    .eq('manage_token', token)
    .single()

  if (!apt) {
    return (
      <div style={{ minHeight: '100vh', background: '#EBF0F6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 24, border: '1px solid #C8D8E4', padding: '48px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>🔍</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0D2B3E', margin: '0 0 8px' }}>Cita no encontrada</h2>
          <p style={{ color: '#4A6B7A', fontSize: 15 }}>El enlace puede haber expirado o ser incorrecto.</p>
        </div>
      </div>
    )
  }

  if (apt.status === 'cancelled') {
    return (
      <div style={{ minHeight: '100vh', background: '#EBF0F6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 24, border: '1px solid #C8D8E4', padding: '48px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>❌</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0D2B3E', margin: '0 0 8px' }}>Esta cita ya fue cancelada</h2>
          <p style={{ color: '#4A6B7A', fontSize: 15 }}>Si necesitas agendar de nuevo, usa el link de tu clínica.</p>
        </div>
      </div>
    )
  }

  // Fetch schedules for the doctor so CalendarPicker can show available days/slots
  const doctor = Array.isArray(apt.doctor) ? apt.doctor[0] : apt.doctor
  const doctorId = (doctor as any)?.id ?? null
  const schedules = doctorId
    ? (await supabaseAdmin.from('schedules').select('id, doctor_id, location_id, day_of_week, start_time, end_time').eq('doctor_id', doctorId)).data ?? []
    : []

  return <ManageAppointmentClient appointment={apt as any} token={token} schedules={schedules} />
}
