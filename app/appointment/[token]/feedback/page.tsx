import { createServiceClient } from '@/lib/supabase/server'
import FeedbackClient from './feedback-client'

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createServiceClient()

  const { data: apt } = await admin
    .from('appointments')
    .select('manage_token, metadata, org:organization_id(name, slug)')
    .eq('manage_token', token)
    .single()

  if (!apt) {
    return (
      <FeedbackClient
        token={token}
        orgName=""
        orgSlug=""
        appointmentExists={false}
        alreadyAnswered={false}
      />
    )
  }

  const org    = Array.isArray(apt.org) ? apt.org[0] : apt.org as { name: string; slug: string } | null
  const meta   = (apt.metadata ?? {}) as Record<string, unknown>
  const alreadyAnswered = Boolean(meta.cancellation_reason)

  return (
    <FeedbackClient
      token={token}
      orgName={org?.name ?? ''}
      orgSlug={org?.slug ?? ''}
      appointmentExists={true}
      alreadyAnswered={alreadyAnswered}
    />
  )
}
