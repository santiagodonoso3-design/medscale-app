import { createServiceClient } from '@/lib/supabase/server'
import BookingClient from '@/components/book/booking-client'

interface BookPageProps {
  params: { orgSlug: string }
}

export default async function BookPage({ params }: BookPageProps) {
  const supabase = await createServiceClient()

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', params.orgSlug)
    .single()

  if (orgError || !organization) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
        Organización no encontrada.
      </div>
    )
  }

  const [{ data: doctors }, { data: locations }, { data: schedules }] = await Promise.all([
    supabase
      .from('doctors')
      .select('id, specialty, is_active, metadata')
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    supabase.from('locations').select('id, name').eq('organization_id', organization.id),
    supabase
      .from('schedules')
      .select('id, doctor_id, location_id, day_of_week, start_time, end_time')
      .eq('organization_id', organization.id)
      .eq('active', true),
  ])

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <BookingClient
        orgName={organization.name}
        orgSlug={params.orgSlug}
        doctors={doctors || []}
        locations={locations || []}
        schedules={schedules || []}
      />
    </div>
  )
}
