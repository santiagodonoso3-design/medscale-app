import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { automationEmail } from '@/lib/email/templates'
import { getAppUrl } from '@/lib/config/urls'

const SAMPLE_VARS = {
  nombre:         'María González',
  nombre_clinica: '', // filled with org.name
  nombre_doctor:  'Dr. Pérez',
}

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

// Renders the automation email with the org branding + sample variables.
// Read-only: nothing is sent and nothing is logged.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    subject?: string
    body?: string
    ctaLabel?: string
    ctaUrl?: string
  }
  if (!body.subject || !body.body) {
    return NextResponse.json({ error: 'subject y body requeridos' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data: org } = await admin
    .from('organizations')
    .select('name, slug, logo_url, primary_color, contact_phone')
    .eq('id', session.orgId)
    .single()
  if (!org) return NextResponse.json({ error: 'Org no encontrada' }, { status: 404 })

  const vars = { ...SAMPLE_VARS, nombre_clinica: org.name }
  const renderedSubject = replaceVars(body.subject, vars)
  const renderedBody    = replaceVars(body.body, vars)

  const brand = {
    logoUrl:      org.logo_url ?? null,
    primaryColor: org.primary_color ?? null,
    contactPhone: org.contact_phone ?? null,
  }
  // ctaUrl defaults to the org booking page (same link the engine uses)
  const ctaUrl = body.ctaUrl ?? (org.slug ? `${getAppUrl(req)}/book/${org.slug}` : undefined)
  const cta = (body.ctaLabel && ctaUrl)
    ? { label: body.ctaLabel, url: ctaUrl }
    : undefined

  const html = automationEmail(org.name, renderedBody, cta, brand)
  return NextResponse.json({ subject: renderedSubject, html })
}
