'use server'

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface ImportLeadRow {
  nombre: string
  cedula?: string
  telefono: string
  email: string
  fuente?: string
  estado?: string
  fecha_creacion?: string
  notas?: string
}

export interface ImportLeadsResult {
  imported: number
  skipped: number
}

export async function importLeads(
  rows: ImportLeadRow[],
  organizationId: string,
): Promise<ImportLeadsResult> {
  if (!rows.length) return { imported: 0, skipped: 0 }

  // Fetch existing emails in this org for duplicate detection
  const emails = rows.map(r => r.email.toLowerCase())
  const { data: existing } = await admin
    .from('leads')
    .select('contact_email')
    .eq('organization_id', organizationId)
    .in('contact_email', emails)

  const existingSet = new Set(
    (existing ?? []).map((l: any) => (l.contact_email ?? '').toLowerCase())
  )

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const email = row.email.toLowerCase()
    if (existingSet.has(email)) { skipped++; continue }
    toInsert.push({
      organization_id: organizationId,
      contact_name:    row.nombre.trim(),
      contact_cedula:  row.cedula?.trim() || null,
      contact_phone:   row.telefono.trim(),
      contact_email:   email,
      source:          row.fuente  || 'manual',
      status:          row.estado  || 'contactado',
      notes:           row.notas?.trim() || null,
      created_at:      row.fecha_creacion
        ? new Date(row.fecha_creacion).toISOString()
        : new Date().toISOString(),
    })
  }

  if (!toInsert.length) return { imported: 0, skipped }

  // Insert in batches of 100 to stay within Supabase limits
  const BATCH = 100
  for (let i = 0; i < toInsert.length; i += BATCH) {
    await admin.from('leads').insert(toInsert.slice(i, i + BATCH))
  }

  return { imported: toInsert.length, skipped }
}
