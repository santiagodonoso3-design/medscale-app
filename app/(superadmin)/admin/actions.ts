'use server'

import { createServiceClient } from '@/lib/supabase/server'

export interface DashboardMetrics {
  totalOrganizations: number
  totalUsers: number
  totalLeads: number
  totalAppointments: number
  recentOrganizations: Array<{
    id: string
    name: string
    slug: string
    plan?: string
    is_active?: boolean
    user_count?: number
    created_at: string
  }>
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  const admin = createServiceClient()

  try {
    const [
      { count: orgCount },
      { count: userCount },
      { count: leadCount },
      { count: appointmentCount },
      { data: recentOrgs },
    ] = await Promise.all([
      admin.from('organizations').select('id', { count: 'exact', head: true }),
      admin.from('organization_members').select('id', { count: 'exact', head: true }),
      admin.from('leads').select('id', { count: 'exact', head: true }),
      admin.from('appointments').select('id', { count: 'exact', head: true }),
      admin.from('organizations')
        .select('id, name, slug, plan, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const organizationsWithUsers = await Promise.all(
      (recentOrgs || []).map(async (org) => {
        const { count } = await admin
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan || 'free',
          is_active: org.is_active !== false,
          user_count: count || 0,
          created_at: org.created_at,
        }
      })
    )

    return {
      totalOrganizations: orgCount || 0,
      totalUsers: userCount || 0,
      totalLeads: leadCount || 0,
      totalAppointments: appointmentCount || 0,
      recentOrganizations: organizationsWithUsers,
    }
  } catch {
    return null
  }
}
