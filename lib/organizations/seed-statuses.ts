import type { SupabaseClient } from '@supabase/supabase-js'

// Catálogo de estados del pipeline que toda org nueva debe tener.
// Debe mantenerse en sincronía con el seed manual de las orgs existentes.
const SYSTEM_STATUSES = [
  { key: 'contactado',               label: 'Contactado',                  color: '#64748b', sort_order: 10 },
  { key: 'cita_valoracion_agendada', label: 'Cita de valoración agendada', color: '#3b82f6', sort_order: 20 },
  { key: 'asistio_cita',             label: 'Asistió a cita',              color: '#10b981', sort_order: 30 },
  { key: 'cancelo_cita',             label: 'Canceló cita',                color: '#ef4444', sort_order: 40 },
  { key: 'en_tratamiento_medico',    label: 'En tratamiento médico',       color: '#f59e0b', sort_order: 50 },
  { key: 'finalizado',               label: 'Finalizado',                  color: '#6b7280', sort_order: 60 },
]

// Siembra el catálogo de estados de una org recién creada. Nunca lanza:
// si falla solo loguea, para no tumbar el flujo de creación de la org.
export async function seedLeadStatuses(admin: SupabaseClient, orgId: string) {
  try {
    const rows = SYSTEM_STATUSES.map((s) => ({
      organization_id: orgId,
      key:             s.key,
      label:           s.label,
      color:           s.color,
      sort_order:      s.sort_order,
      is_system:       true,
    }))

    const { error } = await admin
      .from('lead_statuses')
      .upsert(rows, { onConflict: 'organization_id,key', ignoreDuplicates: true })

    if (error) {
      console.error('[seed-statuses]', orgId, error.message)
    }
  } catch (err) {
    console.error('[seed-statuses]', orgId, err)
  }
}
