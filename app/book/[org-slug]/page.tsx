import { createClient } from '@supabase/supabase-js'
import BookingWizard from '@/components/book/booking-wizard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cliente admin directo — NO importar de lib/supabase/server
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

interface BookPageProps {
  params: { 'org-slug': string }
}

export default async function BookPage({ params }: BookPageProps) {
  console.log('=== BookPage ejecutando ===')
  console.log('params completo:', JSON.stringify(params))

  const supabase = supabaseAdmin
  const slug = params['org-slug']
  console.log('slug extraído:', slug)

  const { data: organization, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single()

  console.log('orgError:', JSON.stringify(orgError))
  console.log('organization:', JSON.stringify(organization))

  if (orgError || !organization) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
        Organización no encontrada.
      </div>
    )
  }

  const [{ data: doctors }, { data: locations }, { data: schedules }, { data: formFields }] = await Promise.all([
    supabase
      .from('doctors')
      .select('id, specialty, is_active, metadata')
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    supabase.from('locations').select('id, name').eq('organization_id', organization.id),
    supabase
      .from('schedules')
      .select('id, doctor_id, location_id, room_id, day_of_week, start_time, end_time')
      .eq('organization_id', organization.id)
      .eq('active', true),
    supabase
      .from('appointment_form_fields')
      .select('field_name, field_type, required, order')
      .eq('organization_id', organization.id)
      .order('order', { ascending: true }),
  ])

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <BookingWizard
        orgName={organization.name}
        orgSlug={slug}
        orgId={organization.id}
        doctors={doctors || []}
        locations={locations || []}
        schedules={schedules || []}
        formFields={formFields || []}
      />
    </div>
  )
}
