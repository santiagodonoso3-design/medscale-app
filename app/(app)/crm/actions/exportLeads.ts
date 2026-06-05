'use server'

import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth/session'
import * as XLSX from 'xlsx'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const STATUS_PIPELINE = [
  { value: 'contactado',               label: 'Contactado' },
  { value: 'cita_valoracion_agendada', label: 'Cita de valoración agendada' },
  { value: 'asistio_cita',             label: 'Asistió a cita' },
  { value: 'cancelo_cita',             label: 'Canceló cita' },
  { value: 'en_tratamiento_medico',    label: 'En tratamiento médico' },
  { value: 'finalizado',               label: 'Finalizado' },
]

const STATUS_NORMALIZE: Record<string, string> = {
  new:              'contactado',
  contacted:        'contactado',
  scheduled:        'cita_valoracion_agendada',
  in_procedure:     'en_tratamiento_medico',
  converted:        'finalizado',
  lost:             'cancelo_cita',
  nuevo:            'contactado',
  agendado:         'cita_valoracion_agendada',
  en_procedimiento: 'en_tratamiento_medico',
  perdido:          'cancelo_cita',
}

const SOURCE_LABELS: Record<string, string> = {
  instagram:    'Instagram',
  whatsapp:     'WhatsApp',
  facebook:     'Facebook',
  web:          'Página web',
  book:         'Agendamiento online',
  referido:     'Referido',
  manual:       'Manual',
  booking:      'Agendamiento online',
  manychat:     'WhatsApp',
  manychat_n8n: 'WhatsApp',
}

export interface ExportFilters {
  status: string
  source: string
  search: string
}

type LeadRow = {
  id: string
  contact_name: string | null
  contact_last_name: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_cedula: string | null
  source: string | null
  status: string
  notes: string | null
  metadata: Record<string, string> | null
  created_at: string
  updated_at: string
}

export async function exportLeads(filters: ExportFilters): Promise<
  { data: string; filename: string; count: number } | { error: string }
> {
  const session = await getSession()
  if (!session) return { error: 'No autorizado' }
  const orgId = session.orgId

  const { data: org } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single()
  const plan = (org as { plan: string } | null)?.plan ?? 'consultorio'
  if (plan !== 'clinica' && plan !== 'red') {
    return { error: 'El export a Excel está disponible en los planes Clínica y Red.' }
  }

  const { data: leadsData, error: leadsErr } = await admin
    .from('leads')
    .select('id, contact_name, contact_last_name, contact_phone, contact_email, contact_cedula, source, status, notes, metadata, created_at, updated_at')
    .eq('organization_id', orgId)
  if (leadsErr) return { error: 'Error al obtener leads' }

  const { data: aptData } = await admin
    .from('appointments')
    .select('lead_id')
    .eq('organization_id', orgId)
  const aptCounts: Record<string, number> = {}
  for (const a of (aptData ?? [])) {
    if (a.lead_id) aptCounts[a.lead_id] = (aptCounts[a.lead_id] ?? 0) + 1
  }

  const { data: fieldsData } = await admin
    .from('org_custom_fields')
    .select('field_name, field_label, sort_order')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
  const customFields = (fieldsData ?? []) as { field_name: string; field_label: string; sort_order: number }[]

  const normalized = ((leadsData ?? []) as LeadRow[]).map(l => ({
    ...l,
    status: STATUS_NORMALIZE[l.status] ?? l.status,
  }))

  const { status: statusFilter, source: sourceFilter, search } = filters
  const filteredLeads = normalized.filter(lead => {
    const matchStatus = statusFilter === 'all' || lead.status === statusFilter
    const matchSource = sourceFilter === 'all' || lead.source === sourceFilter
    const q = search.toLowerCase()
    const matchSearch = !search ||
      lead.contact_name?.toLowerCase().includes(q) ||
      lead.contact_last_name?.toLowerCase().includes(q) ||
      lead.contact_phone?.includes(search) ||
      lead.contact_email?.toLowerCase().includes(q) ||
      lead.contact_cedula?.includes(search) ||
      Object.values(lead.metadata ?? {}).some(v => String(v).toLowerCase().includes(q))
    return matchStatus && matchSource && matchSearch
  })

  const fmt = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota',
  })

  const rows = filteredLeads.map(lead => {
    const statusEntry = STATUS_PIPELINE.find(s => s.value === lead.status)
    const statusLabelStr = statusEntry?.label ?? lead.status

    const row: Record<string, string | number> = {
      'Nombre': [lead.contact_name, lead.contact_last_name].filter(Boolean).join(' ').trim(),
      'Número de Identificación': lead.contact_cedula ?? '',
      'Teléfono': lead.contact_phone ?? '',
      'Email': lead.contact_email ?? '',
      'Estado': statusLabelStr,
      'Fuente': SOURCE_LABELS[lead.source ?? ''] ?? (lead.source ?? 'Otra'),
      'Citas': aptCounts[lead.id] ?? 0,
      'Creado': lead.created_at ? fmt.format(new Date(lead.created_at)) : '',
      'Actualizado': lead.updated_at ? fmt.format(new Date(lead.updated_at)) : '',
      'Notas': lead.notes ?? '',
    }

    for (const field of customFields) {
      row[field.field_label] = (lead.metadata as Record<string, string> | null)?.[field.field_name] ?? ''
    }

    return row
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string

  const today = new Date().toISOString().slice(0, 10)
  return { data: base64, filename: `leads-${today}.xlsx`, count: filteredLeads.length }
}
