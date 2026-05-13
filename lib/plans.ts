import { createServiceClient } from '@/lib/supabase/server'

export const PLAN_LIMITS = {
  free:    { doctors: 1,        leads: 50,       appointmentsPerMonth: 20 },
  starter: { doctors: 3,        leads: Infinity, appointmentsPerMonth: 100 },
  growth:  { doctors: 8,        leads: Infinity, appointmentsPerMonth: Infinity },
  scale:   { doctors: Infinity, leads: Infinity, appointmentsPerMonth: Infinity },
} as const

export type PlanId = keyof typeof PLAN_LIMITS

type Resource = 'doctors' | 'leads' | 'appointments'

export interface PlanCheckResult {
  allowed: boolean
  limit: number  // -1 means unlimited
  current: number
  plan: string
}

export function limitErrorMessage(result: PlanCheckResult, resourceLabel: string): string {
  const limitStr = result.limit === -1 ? '∞' : String(result.limit)
  return `Has alcanzado el límite de ${limitStr} ${resourceLabel} en tu plan ${result.plan}. Actualiza tu plan para continuar.`
}

export async function checkPlanLimit(orgId: string, resource: Resource): Promise<PlanCheckResult> {
  const admin = createServiceClient()

  const { data: org } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single()

  const plan = ((org?.plan as string) ?? 'free') as PlanId
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free

  let current = 0
  let limit: number

  if (resource === 'doctors') {
    limit = limits.doctors === Infinity ? -1 : limits.doctors
    const { count } = await admin
      .from('doctors')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true)
    current = count ?? 0
  } else if (resource === 'leads') {
    limit = limits.leads === Infinity ? -1 : limits.leads
    const { count } = await admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
    current = count ?? 0
  } else {
    limit = limits.appointmentsPerMonth === Infinity ? -1 : limits.appointmentsPerMonth
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count } = await admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('scheduled_at', monthStart)
    current = count ?? 0
  }

  const allowed = limit === -1 || current < limit

  return { allowed, limit, current, plan }
}
