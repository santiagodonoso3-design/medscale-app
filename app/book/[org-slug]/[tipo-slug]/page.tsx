import { createClient } from '@supabase/supabase-js'
import BookingWizard from '@/components/book/booking-wizard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface PageProps {
  params: { 'org-slug': string; 'tipo-slug': string }
}

export default async function BookTypePage({ params }: PageProps) {
  const resolvedParams = await params
  const orgSlug  = resolvedParams['org-slug']
  const tipoSlug = resolvedParams['tipo-slug']

  const { data: organization, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .single()

  if (orgError || !organization) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
        Organización no encontrada.
      </div>
    )
  }

  const { data: appointmentType, error: typeError } = await supabaseAdmin
    .from('appointment_types')
    .select('id, name, slug, duration_minutes, modality, color, doctor_ids, min_notice_hours, languages')
    .eq('organization_id', organization.id)
    .eq('slug', tipoSlug)
    .eq('active', true)
    .single()

  if (typeError || !appointmentType) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
        Tipo de cita no encontrado.
      </div>
    )
  }

  const [{ data: doctors }, { data: locations }, { data: formFields }] = await Promise.all([
    supabaseAdmin
      .from('doctors')
      .select('id, specialty, is_active, metadata')
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    supabaseAdmin.from('locations').select('id, name').eq('organization_id', organization.id),
    supabaseAdmin
      .from('appointment_form_fields')
      .select('field_name, field_type, required, order')
      .eq('organization_id', organization.id)
      .order('order', { ascending: true }),
  ])

  const { data: schedules } = await supabaseAdmin
    .from('schedules')
    .select('id, doctor_id, location_id, day_of_week, start_time, end_time')
    .in('doctor_id', (doctors || []).map(d => d.id))

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <BookingWizard
        orgName={organization.name}
        orgSlug={orgSlug}
        orgId={organization.id}
        doctors={doctors || []}
        locations={locations || []}
        schedules={schedules || []}
        formFields={formFields || []}
        appointmentType={{
          name:             appointmentType.name,
          slug:             appointmentType.slug,
          duration_minutes: appointmentType.duration_minutes,
          modality:         appointmentType.modality as 'presencial' | 'virtual' | 'patient_choice',
          color:            appointmentType.color,
          doctor_ids:       appointmentType.doctor_ids ?? [],
          languages:        appointmentType.languages ?? ['es'],
        }}
      />
    </div>
  )
}
