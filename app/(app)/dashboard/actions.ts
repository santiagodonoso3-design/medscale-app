'use server'

import { unstable_noStore as noStore } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/session'

// ── Timezone helpers (Bogotá = UTC-5, no DST) ────────────────────────────────

function toBogotaYM(iso: string): string {
  // en-CA gives "YYYY-MM-DD" — same reliable format as todayBogota()
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(iso)).slice(0, 7)
}

function currentBogotaYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'America/Bogota' }).format(new Date())
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RawAppointment {
  id: string
  scheduled_at: string
  created_at: string
  status: string
  doctor_id: string
  lead_id: string
  doctor_assignment_type: string | null
  ym: string  // YYYY-MM in Bogota tz, pre-computed server-side
  price: number | null
  modality: string | null
  appointment_type_id: string | null
  cancellationReason: string | null
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

export interface RawProcedureLead {
  lead_id: string
  procedure_price: number
  procedure_month: string  // YYYY-MM in Bogota tz
}

export interface RawDashboardData {
  year: number
  appointments: RawAppointment[]
  yearLeads: RawLead[]
  doctors: RawDoctor[]
  appointmentTypes: AppointmentTypeInfo[]
  procedureLeads: RawProcedureLead[]
}

// ── Fetch all data for a given year ──────────────────────────────────────────

export async function getDashboardRawData(year: number): Promise<RawDashboardData | null> {
  noStore()
  try {
    const { orgId } = await requireOrgContext()
    if (!Number.isInteger(year) || year < 2020 || year > 2030) return null
    const admin    = createServiceClient()
    const fromDate = `${year}-01-01`
    const toDate   = `${year + 1}-01-01`

    const [
      { data: apts },
      { data: yearLeadsRaw },
      { data: doctorsRaw },
      { data: apptTypesRaw },
      { data: procLeadsRaw },
    ] = await Promise.all([
      admin.from('appointments')
        .select('id, scheduled_at, created_at, status, doctor_id, lead_id, doctor_assignment_type, price, modality, appointment_type_id, metadata')
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
      admin.from('appointment_types')
        .select('id, assignment_mode')
        .eq('organization_id', orgId),
      admin.from('lead_procedures')
        .select('id, lead_id, procedure_price, performed_at, created_at')
        .eq('organization_id', orgId),
    ])

    // Procedure revenue desde lead_procedures (N por lead). Ningún procedimiento se descarta.
    // Fecha en cascada: performed_at → última cita completed → created_at del procedimiento.
    let procedureLeads: RawProcedureLead[] = []
    if (procLeadsRaw && (procLeadsRaw as any[]).length > 0) {
      const rows = procLeadsRaw as any[]

      // Última cita completed por lead (solo para filas sin performed_at)
      const leadIdsSinFecha = [...new Set(
        rows.filter(r => !r.performed_at).map(r => r.lead_id)
      )]

      const latestByLead = new Map<string, string>()
      if (leadIdsSinFecha.length > 0) {
        const { data: procApts } = await admin
          .from('appointments')
          .select('lead_id, scheduled_at')
          .in('lead_id', leadIdsSinFecha)
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false })
        for (const a of (procApts ?? [])) {
          if (a.lead_id && !latestByLead.has(a.lead_id)) {
            latestByLead.set(a.lead_id, a.scheduled_at)
          }
        }
      }

      procedureLeads = rows.map((r: any) => {
        let procedure_month: string
        if (r.performed_at) {
          procedure_month = r.performed_at.slice(0, 7)                 // YYYY-MM directo, sin tz
        } else if (latestByLead.has(r.lead_id)) {
          procedure_month = toBogotaYM(latestByLead.get(r.lead_id)!)   // cita completed
        } else {
          procedure_month = toBogotaYM(r.created_at)                   // fallback: creación del procedimiento
        }
        return {
          lead_id: r.lead_id,
          procedure_price: Number(r.procedure_price),
          procedure_month,
        }
      })
    }

    const appointments: RawAppointment[] = (apts ?? []).map((a: any) => ({
      id: a.id,
      scheduled_at: a.scheduled_at,
      created_at: a.created_at,
      status: a.status,
      doctor_id: a.doctor_id,
      lead_id: a.lead_id ?? '',
      doctor_assignment_type: a.doctor_assignment_type ?? null,
      ym: toBogotaYM(a.scheduled_at),
      price: typeof a.price === 'number' ? a.price : null,
      modality: a.modality ?? null,
      appointment_type_id: a.appointment_type_id ?? null,
      cancellationReason: typeof a.metadata?.cancellation_reason === 'string'
        ? a.metadata.cancellation_reason : null,
    }))

    const yearLeads: RawLead[] = (yearLeadsRaw ?? []).map((l: any) => ({
      id: l.id, status: l.status, created_at: l.created_at,
      ym: toBogotaYM(l.created_at),
    }))

    const doctors: RawDoctor[] = (doctorsRaw ?? []).map((d: any) => ({
      id: d.id, name: String(d.metadata?.name ?? 'Médico'),
    }))

    const appointmentTypes: AppointmentTypeInfo[] = (apptTypesRaw ?? []).map((t: any) => ({
      id: t.id,
      assignment_mode: t.assignment_mode ?? 'hybrid',
    }))

    return { year, appointments, yearLeads, doctors, appointmentTypes, procedureLeads }
  } catch (e) {
    console.error('getDashboardRawData error:', e)
    return null
  }
}

// ── Years that have appointment or lead data ──────────────────────────────────

export async function getDashboardYears(): Promise<number[]> {
  try {
    const { orgId } = await requireOrgContext()
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
