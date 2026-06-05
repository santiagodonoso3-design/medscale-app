'use server'
import { createServiceClient } from '@/lib/supabase/server'

export interface OrgMetric {
  id: string
  name: string
  slug: string
  plan: string
  is_active: boolean
  monthly_revenue: number
  user_count: number
  doctor_count: number
  lead_count: number
  appointments_this_month: number
  appointments_last_month: number
  created_at: string
}

export interface DashboardMetrics {
  totalOrganizations: number
  activeOrganizations: number
  totalUsers: number
  totalLeads: number
  totalAppointments: number
  mrr: number
  appointmentsThisMonth: number
  appointmentsLastMonth: number
  organizations: OrgMetric[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  const admin = createServiceClient()

  try {
    const now = new Date()
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

    const { data: orgs, error: orgsError } = await admin
      .from('organizations')
      .select('id, name, slug, plan, is_active, monthly_revenue, created_at')
      .order('created_at', { ascending: false })

    if (orgsError || !orgs) return null

    const [
      { count: totalUsers },
      { count: totalLeads },
      { count: totalAppointments },
      { count: appointmentsThisMonth },
      { count: appointmentsLastMonth },
    ] = await Promise.all([
      admin.from('organization_members').select('id', { count: 'exact', head: true }),
      admin.from('leads').select('id', { count: 'exact', head: true }),
      admin.from('appointments').select('id', { count: 'exact', head: true }),
      admin.from('appointments').select('id', { count: 'exact', head: true })
        .gte('scheduled_at', firstDayThisMonth),
      admin.from('appointments').select('id', { count: 'exact', head: true })
        .gte('scheduled_at', firstDayLastMonth)
        .lte('scheduled_at', lastDayLastMonth),
    ])

    const orgMetrics = await Promise.all(
      orgs.map(async (org) => {
        const [
          { count: userCount },
          { count: doctorCount },
          { count: leadCount },
          { count: aptsThisMonth },
          { count: aptsLastMonth },
        ] = await Promise.all([
          admin.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
          admin.from('doctors').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('is_active', true),
          admin.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
          admin.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).gte('scheduled_at', firstDayThisMonth),
          admin.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).gte('scheduled_at', firstDayLastMonth).lte('scheduled_at', lastDayLastMonth),
        ])

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan || 'consultorio',
          is_active: org.is_active !== false,
          monthly_revenue: org.monthly_revenue || 0,
          user_count: userCount || 0,
          doctor_count: doctorCount || 0,
          lead_count: leadCount || 0,
          appointments_this_month: aptsThisMonth || 0,
          appointments_last_month: aptsLastMonth || 0,
          created_at: org.created_at,
        }
      })
    )

    const activeOrgs = orgs.filter(o => o.is_active !== false)
    const mrr = activeOrgs.reduce((sum, o) => sum + (o.monthly_revenue || 0), 0)

    return {
      totalOrganizations: orgs.length,
      activeOrganizations: activeOrgs.length,
      totalUsers: totalUsers || 0,
      totalLeads: totalLeads || 0,
      totalAppointments: totalAppointments || 0,
      mrr,
      appointmentsThisMonth: appointmentsThisMonth || 0,
      appointmentsLastMonth: appointmentsLastMonth || 0,
      organizations: orgMetrics,
    }
  } catch {
    return null
  }
}
