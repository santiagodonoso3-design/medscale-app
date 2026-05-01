'use server'

import { createClient } from '@/lib/supabase/server'

export interface OrgDashboardMetrics {
  totalLeadsThisMonth: number
  totalAppointments: number
  leadsBySource: {
    whatsapp: number
    instagram: number
    facebook: number
  }
  appointmentsToday: number
}

export async function getOrgDashboardMetrics(): Promise<OrgDashboardMetrics | null> {
  const supabase = await createClient()

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(todayStart.getDate() + 1)

    const [
      leadsThisMonthResult,
      totalAppointmentsResult,
      whatsappLeadsResult,
      instagramLeadsResult,
      facebookLeadsResult,
      todayAppointmentsResult,
    ] = await Promise.all([
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart.toISOString())
        .lt('created_at', nextMonth.toISOString()),
      supabase.from('appointments').select('id', { count: 'exact', head: true }),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'whatsapp'),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'instagram'),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'facebook'),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', todayStart.toISOString())
        .lt('scheduled_at', tomorrowStart.toISOString()),
    ])

    return {
      totalLeadsThisMonth: leadsThisMonthResult.count || 0,
      totalAppointments: totalAppointmentsResult.count || 0,
      leadsBySource: {
        whatsapp: whatsappLeadsResult.count || 0,
        instagram: instagramLeadsResult.count || 0,
        facebook: facebookLeadsResult.count || 0,
      },
      appointmentsToday: todayAppointmentsResult.count || 0,
    }
  } catch (error) {
    console.error('Error fetching org dashboard metrics:', error)
    return null
  }
}
