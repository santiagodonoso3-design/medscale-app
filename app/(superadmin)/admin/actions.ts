'use server'

import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()

  try {
    // Get total organizations
    const { count: orgCount } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true })

    // Get total users
    const { count: userCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })

    // Get total leads
    const { count: leadCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })

    // Get total appointments
    const { count: appointmentCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })

    // Get recent organizations
    const { data: recentOrgs } = await supabase
      .from('organizations')
      .select('id, name, slug, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    // Get user counts per organization
    const organizationsWithUsers = await Promise.all(
      (recentOrgs || []).map(async (org) => {
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)

        const metadata = org.metadata as Record<string, any> || {}

        return {
          ...org,
          plan: metadata.plan || 'starter',
          is_active: metadata.is_active !== false,
          user_count: count || 0,
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
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error)
    return null
  }
}
