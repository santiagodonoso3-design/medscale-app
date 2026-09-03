import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

// Read-only: per-rule send stats of the org (last 30 days), aggregated in TS.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // All logs of the org from the last 30 days (aggregated below)
  const { data, error } = await admin
    .from('automation_logs')
    .select('automation_rule_id, sent_at, status')
    .eq('organization_id', session.orgId)
    .gte('sent_at', thirtyDaysAgo)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type StatsMap = Record<string, { sent_30d: number; last_sent_at: string | null }>
  const stats: StatsMap = {}
  for (const log of (data ?? [])) {
    const key = log.automation_rule_id as string
    if (!stats[key]) stats[key] = { sent_30d: 0, last_sent_at: null }
    if (log.status === 'sent') {
      stats[key].sent_30d++
      const sentAt = log.sent_at as string
      if (!stats[key].last_sent_at || sentAt > stats[key].last_sent_at!) {
        stats[key].last_sent_at = sentAt
      }
    }
  }
  return NextResponse.json(stats)
}
