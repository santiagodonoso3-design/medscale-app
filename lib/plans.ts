import { createServiceClient } from '@/lib/supabase/server'

export const PLAN_LIMITS = {
  consultorio: { doctors: 1,        locations: 1,        api: false },
  clinica:     { doctors: 6,        locations: 1,        api: false },
  red:         { doctors: Infinity, locations: Infinity, api: true  },
} as const

export type PlanId = keyof typeof PLAN_LIMITS

type Resource = 'doctors' | 'locations'

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

  const plan = ((org?.plan as string) ?? 'consultorio') as PlanId
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.consultorio

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
  } else {
    limit = limits.locations === Infinity ? -1 : limits.locations
    const { count } = await admin
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
    current = count ?? 0
  }

  const allowed = limit === -1 || current < limit

  return { allowed, limit, current, plan }
}
