'use server'

import { unstable_noStore as noStore } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

// ── Timezone helpers (Bogotá = UTC-5, no DST) ────────────────────────────────

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

function toBogotaYM(iso: string): string {
  const d = new Date(iso)
  const year = new Intl.DateTimeFormat('en', {
    year: 'numeric', timeZone: 'America/Bogota',
  }).format(d)
  const month = new Intl.DateTimeFormat('en', {
    month: '2-digit', timeZone: 'America/Bogota',
  }).format(d)
  return `${year}-${month}`
}

function currentBogotaYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'America/Bogota' }).format(new Date())
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TodayAppointment {
  id: string
  scheduled_at: string
  status: string
  patientName: string | null
  doctorName: string | null
}

export interface RawAppointment {
  id: string
  scheduled_at: string
  status: string
  doctor_id: string
  lead_id: string
  doctor_assignment_type: string | null
  ym: string  // YYYY-MM in Bogota tz, pre-computed server-side
  price: number | null
  modality: string | null
  appointment_type_id: string | null
}

export interface RawLead {
  id: string
  status: string
  created_at: string
  ym: string  // YYYY-MM in Bogota tz, pre-computed server-side
}

export interface RawDoctor {
  id: string
  name: string
}

export interface AppointmentTypeInfo {
  id: string
  assignment_mode: string
}

export interface RawDashboardData {
  year: number
  appointments: RawAppointment[]
  yearLeads: RawLead[]
  doctors: RawDoctor[]
  todayAppointments: TodayAppointment[]
  appointmentTypes: AppointmentTypeInfo[]
}

// ── Fetch all data for a given year ──────────────────────────────────────────

export async function getDashboardRawData(year: number, orgId: string): Promise<RawDashboardData | null> {
  noStore()
  try {
    const admin  = createServiceClient()
    const today  = todayBogota()
    const fromDate = `${year}-01-01`
    const toDate   = `${year + 1}-01-01`

    const [
      { data: apts, error: _aptError },
      { data: yearLeadsRaw },
      { data: doctorsRaw },
      { data: todayRaw },
      { data: apptTypesRaw },
    ] = await Promise.all([
      admin.from('appointments')
        .select('id, scheduled_at, status, doctor_id, lead_id, doctor_assignment_type, price, modality, appointment_type_id')
        .eq('organization_id', orgId)
        .gte('scheduled_at', fromDate)
        .lt('scheduled_at', toDate),
      admin.from('leads')
        .select('id, status, created_at')
        .eq('organization_id', orgId)
        .gte('created_at', fromDate)
        .lt('created_at', toDate),
      admin.from('doctors')
        .select('id, metadata')
        .eq('organization_id', orgId)
        .eq('is_active', true),
      admin.from('appointments')
        .select('id, scheduled_at, status, lead:lead_id(contact_name,contact_last_name), doctor:doctor_id(metadata)')
        .eq('organization_id', orgId)
        .gte('scheduled_at', today + 'T00:00:00')
        .lte('scheduled_at', today + 'T23:59:59')
        .order('scheduled_at', { ascending: true }),
      admin.from('appointment_types')
        .select('id, assignment_mode')
        .eq('organization_id', orgId),
    ])


    const appointments: RawAppointment[] = (apts ?? []).map((a: any) => ({
      id: a.id,
      scheduled_at: a.scheduled_at,
      status: a.status,
      doctor_id: a.doctor_id,
      lead_id: a.lead_id ?? '',
      doctor_assignment_type: a.doctor_assignment_type ?? null,
      ym: toBogotaYM(a.scheduled_at),
      price: typeof a.price === 'number' ? a.price : null,
      modality: a.modality ?? null,
      appointment_type_id: a.appointment_type_id ?? null,
    }))

    const yearLeads: RawLead[] = (yearLeadsRaw ?? []).map((l: any) => ({
      id: l.id, status: l.status, created_at: l.created_at,
      ym: toBogotaYM(l.created_at),
    }))

    const doctors: RawDoctor[] = (doctorsRaw ?? []).map((d: any) => ({
      id: d.id, name: String(d.metadata?.name ?? 'Médico'),
    }))

    const todayAppointments: TodayAppointment[] = (todayRaw ?? []).map((a: any) => ({
      id: a.id, scheduled_at: a.scheduled_at, status: a.status,
      patientName: (() => {
        const l = Array.isArray(a.lead) ? a.lead[0] : a.lead
        return [l?.contact_name, l?.contact_last_name].filter(Boolean).join(' ') || null
      })(),
      doctorName: (Array.isArray(a.doctor) ? a.doctor[0]?.metadata?.name : a.doctor?.metadata?.name) ?? null,
    }))

    const appointmentTypes: AppointmentTypeInfo[] = (apptTypesRaw ?? []).map((t: any) => ({
      id: t.id,
      assignment_mode: t.assignment_mode ?? 'hybrid',
    }))

    return {
      year, appointments, yearLeads,
      doctors, todayAppointments, appointmentTypes,
    }
  } catch (e) {
    console.error('getDashboardRawData error:', e)
    return null
  }
}

// ── Years that have appointment or lead data ──────────────────────────────────

export async function getDashboardYears(orgId: string): Promise<number[]> {
  try {
    const admin   = createServiceClient()
    const curYear = currentBogotaYear()
    const [{ data: firstApt }, { data: firstLead }] = await Promise.all([
      admin.from('appointments').select('scheduled_at').eq('organization_id', orgId).order('scheduled_at', { ascending: true }).limit(1),
      admin.from('leads').select('created_at').eq('organization_id', orgId).order('created_at', { ascending: true }).limit(1),
    ])
    let minYear = curYear
    if (firstApt?.[0]?.scheduled_at) minYear = Math.min(minYear, Number(firstApt[0].scheduled_at.slice(0, 4)))
    if (firstLead?.[0]?.created_at)  minYear = Math.min(minYear, Number(firstLead[0].created_at.slice(0, 4)))
    const years: number[] = []
    for (let y = minYear; y <= curYear; y++) years.push(y)
    return years
  } catch {
    return [new Date().getFullYear()]
  }
}
