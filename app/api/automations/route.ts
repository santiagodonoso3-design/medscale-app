import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

const FIXED_RULE_TYPES = ['followup_post_cita', 'noshow_recovery', 'procedure_followup', 'procedure_completed', 'birthday']
const ALL_RULE_TYPES = [...FIXED_RULE_TYPES, 'special_date']

// Audiences with dedicated engine logic (lib/automations/process.ts). Any other
// value must be an ACTIVE lead_statuses.key of the org.
const RESERVED_AUDIENCES = ['all', 'birthday', 'noshow'] as const

async function validateAudience(
  admin: ReturnType<typeof createServiceClient>,
  orgId: string,
  audience: string | null | undefined,
  ruleType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!audience) return { ok: true }

  // lead_status requires a real status, never a reserved keyword (the engine skips them)
  if (ruleType === 'lead_status' && (audience === 'all' || audience === 'birthday')) {
    return { ok: false, error: 'Las reglas de estado del lead requieren un status específico, no "todos" ni "cumpleaños"' }
  }

  if ((RESERVED_AUDIENCES as readonly string[]).includes(audience)) {
    return { ok: true }
  }

  const { data } = await admin
    .from('lead_statuses')
    .select('key')
    .eq('organization_id', orgId)
    .eq('key', audience)
    .eq('is_active', true)
    .maybeSingle()

  if (!data) {
    return { ok: false, error: `El estado "${audience}" no existe o está inactivo en tu organización` }
  }
  return { ok: true }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('automation_rules')
    .select('id, rule_type, name, description, delay_days, trigger_date, email_subject, email_body, audience, is_active, created_at')
    .eq('organization_id', session.orgId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { rule_type, name, description, delay_days, trigger_date, email_subject, email_body, audience } = body

  if (!rule_type || !ALL_RULE_TYPES.includes(rule_type))
    return NextResponse.json({ error: 'Tipo de regla inválido' }, { status: 400 })
  if (!name?.trim())
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!email_subject?.trim())
    return NextResponse.json({ error: 'Asunto del email requerido' }, { status: 400 })
  if (!email_body?.trim())
    return NextResponse.json({ error: 'Cuerpo del email requerido' }, { status: 400 })

  const admin = createServiceClient()

  const audienceCheck = await validateAudience(admin, session.orgId, audience, rule_type)
  if (!audienceCheck.ok) {
    return NextResponse.json({ error: audienceCheck.error }, { status: 400 })
  }

  if (FIXED_RULE_TYPES.includes(rule_type)) {
    const { data: existing } = await admin
      .from('automation_rules')
      .select('id')
      .eq('organization_id', session.orgId)
      .eq('rule_type', rule_type)
      .maybeSingle()
    if (existing)
      return NextResponse.json({ error: 'Ya existe una regla de este tipo para tu organización' }, { status: 409 })
  }

  const { data, error } = await admin
    .from('automation_rules')
    .insert({
      organization_id: session.orgId,
      rule_type,
      name: name.trim(),
      description: description?.trim() || null,
      delay_days: delay_days !== null && delay_days !== undefined ? Number(delay_days) : null,
      trigger_date: trigger_date || null,
      email_subject: email_subject.trim(),
      email_body: email_body.trim(),
      audience: audience ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { id, name, description, delay_days, trigger_date, email_subject, email_body, audience, is_active } = body
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = String(name).trim()
  if (description !== undefined) updates.description = description?.trim() || null
  if (delay_days !== undefined) updates.delay_days = delay_days !== null ? Number(delay_days) : null
  if (trigger_date !== undefined) updates.trigger_date = trigger_date || null
  if (email_subject !== undefined) updates.email_subject = String(email_subject).trim()
  if (email_body !== undefined) updates.email_body = String(email_body).trim()
  if (audience !== undefined) updates.audience = audience ?? null
  if (is_active !== undefined) updates.is_active = Boolean(is_active)

  const admin = createServiceClient()

  // Validate audience against the rule's own rule_type (the body does not carry it)
  if (audience !== undefined && audience !== null) {
    const { data: existingRule } = await admin
      .from('automation_rules')
      .select('rule_type')
      .eq('id', id)
      .eq('organization_id', session.orgId)
      .maybeSingle()
    if (!existingRule) {
      return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 })
    }
    const audienceCheck = await validateAudience(admin, session.orgId, audience, existingRule.rule_type)
    if (!audienceCheck.ok) {
      return NextResponse.json({ error: audienceCheck.error }, { status: 400 })
    }
  }

  const { data, error } = await admin
    .from('automation_rules')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', session.orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const admin = createServiceClient()

  const { data: rule } = await admin
    .from('automation_rules')
    .select('rule_type')
    .eq('id', id)
    .eq('organization_id', session.orgId)
    .maybeSingle()

  if (!rule) return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 })
  if (rule.rule_type !== 'special_date')
    return NextResponse.json({ error: 'Solo se pueden eliminar reglas de tipo fecha especial' }, { status: 403 })

  const { error } = await admin
    .from('automation_rules')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
