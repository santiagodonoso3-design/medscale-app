'use server'

import { createClient } from '@/lib/supabase/server'

export interface UpcomingAppointment {
  id: string
  scheduled_at: string
  status: string
  notes: string | null
  patient_name: string | null
  patient_phone: string | null
  doctor_name: string | null
}

export interface RecentLead {
  id: string
  contact_name: string | null
  contact_phone: string | null
  source: string | null
  status: string
  created_at: string
}

export interface OrgDashboardMetrics {
  appointmentsToday: number
  appointmentsThisWeek: number
  totalLeads: number
  totalPatients: number
  upcomingAppointments: UpcomingAppointment[]
  recentLeads: RecentLead[]
}

export async function getOrgDashboardMetrics(): Promise<OrgDashboardMetrics | null> {
  const supabase = await createClient()

  try {
    const now = new Date()

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(todayStart.getDate() + 1)

    // Week: Monday → Sunday
    const dow = now.getDay()
    const daysFromMonday = dow === 0 ? 6 : dow - 1
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - daysFromMonday)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const [
      todayResult,
      weekResult,
      leadsResult,
      upcomingResult,
      recentLeadsResult,
    ] = await Promise.all([
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', todayStart.toISOString())
        .lt('scheduled_at', tomorrowStart.toISOString()),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', weekStart.toISOString())
        .lt('scheduled_at', weekEnd.toISOString()),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase
        .from('appointments')
        .select('id, scheduled_at, status, notes, lead:lead_id(contact_name, contact_phone), doctor:doctor_id(metadata)')
        .gte('scheduled_at', now.toISOString())
        .neq('status', 'cancelled')
        .order('scheduled_at', { ascending: true })
        .limit(10),
      supabase
        .from('leads')
        .select('id, contact_name, contact_phone, source, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const upcoming: UpcomingAppointment[] = (upcomingResult.data ?? []).map((a: any) => ({
      id: a.id,
      scheduled_at: a.scheduled_at,
      status: a.status,
      notes: a.notes ?? null,
      patient_name: a.lead?.[0]?.contact_name ?? null,
      patient_phone: a.lead?.[0]?.contact_phone ?? null,
      doctor_name: a.doctor?.[0]?.metadata?.name ?? null,
    }))

    return {
      appointmentsToday: todayResult.count ?? 0,
      appointmentsThisWeek: weekResult.count ?? 0,
      totalLeads: leadsResult.count ?? 0,
      totalPatients: leadsResult.count ?? 0,
      upcomingAppointments: upcoming,
      recentLeads: (recentLeadsResult.data ?? []) as RecentLead[],
    }
  } catch (error) {
    console.error('Error fetching org dashboard metrics:', error)
    return null
  }
}
