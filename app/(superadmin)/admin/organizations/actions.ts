'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resend } from '@/lib/email/resend'
import { requirePlatformAdmin, requirePlatformAdminScope, assertOrgAllowed } from '@/lib/auth/session'
import { runScheduledDeletions } from '@/lib/admin/deletions'
import { seedLeadStatuses } from '@/lib/organizations/seed-statuses'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'consultorio' | 'clinica' | 'red'
  is_active: boolean
  ai_agent_enabled: boolean
  monthly_revenue: number
  user_count: number
  created_at: string
  pending_deletion_at: string | null
}

export async function getAllOrganizations(): Promise<Organization[] | null> {
  const scope = await requirePlatformAdminScope()
  const admin = createServiceClient()

  try {
    let orgsQuery = admin
      .from('organizations')
      .select('id, name, slug, plan, is_active, ai_agent_enabled, monthly_revenue, created_at, pending_deletion_at')
    if (scope.orgIds !== null) orgsQuery = orgsQuery.in('id', scope.orgIds)
    const { data: orgs, error } = await orgsQuery.order('created_at', { ascending: false })

    if (error) return null

    const organizationsWithData = await Promise.all(
      (orgs || []).map(async (org) => {
        const { count } = await admin
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: (org.plan || 'consultorio') as 'consultorio' | 'clinica' | 'red',
          is_active: org.is_active !== false,
          ai_agent_enabled: org.ai_agent_enabled === true,
          monthly_revenue: org.monthly_revenue || 0,
          user_count: count || 0,
          created_at: org.created_at,
          pending_deletion_at: org.pending_deletion_at || null,
        }
      })
    )

    return organizationsWithData
  } catch {
    return null
  }
}

export async function createOrganization(
  name: string,
  slug: string,
  plan: 'consultorio' | 'clinica' | 'red'
): Promise<{ success: boolean; error?: string; organization?: Organization }> {
  const scope = await requirePlatformAdminScope()
  if (scope.orgIds !== null) throw new Error('FORBIDDEN')
  const admin = createServiceClient()

  try {
    const { data: existing } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) return { success: false, error: 'El slug ya está en uso' }

    const { data: newOrg, error } = await admin
      .from('organizations')
      .insert({ name, slug, plan, is_active: true, ai_agent_enabled: false, monthly_revenue: 0 })
      .select('id, name, slug, plan, is_active, ai_agent_enabled, monthly_revenue, created_at, pending_deletion_at')
      .single()

    if (error || !newOrg) {
      return { success: false, error: error?.message || 'Error creando organización' }
    }

    await seedLeadStatuses(admin, newOrg.id)

    const organization: Organization = {
      id: newOrg.id,
      name: newOrg.name,
      slug: newOrg.slug,
      plan: (newOrg.plan || 'consultorio') as 'consultorio' | 'clinica' | 'red',
      is_active: newOrg.is_active !== false,
      ai_agent_enabled: newOrg.ai_agent_enabled === true,
      monthly_revenue: newOrg.monthly_revenue || 0,
      user_count: 0,
      created_at: newOrg.created_at,
      pending_deletion_at: null,
    }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    return { success: true, organization }
  } catch {
    return { success: false, error: 'Error interno del servidor' }
  }
}

export async function updateOrganization(
  id: string,
  name: string,
  slug: string,
  plan: 'consultorio' | 'clinica' | 'red',
  is_active: boolean,
  ai_agent_enabled: boolean,
  monthly_revenue: number
): Promise<{ success: boolean; error?: string }> {
  await assertOrgAllowed(id)
  const admin = createServiceClient()

  try {
    const { error } = await admin
      .from('organizations')
      .update({ name, slug, plan, is_active, ai_agent_enabled, monthly_revenue })
      .eq('id', id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    return { success: true }
  } catch {
    return { success: false, error: 'Error interno del servidor' }
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function getOrgOwnerEmail(orgId: string): Promise<{ email: string; name: string } | null> {
  const admin = createServiceClient()
  try {
    const { data: member } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('role', 'owner')
      .single()
    if (!member?.user_id) return null

    const { data: userData } = await admin.auth.admin.getUserById(member.user_id)
    if (!userData?.user?.email) return null

    return {
      email: userData.user.email,
      name: (userData.user.user_metadata?.clinic_name as string) ?? userData.user.email,
    }
  } catch {
    return null
  }
}

function deletionWarningEmail(orgName: string): string {
  const SG = `font-family:'Space Grotesk','Inter',Helvetica,Arial,sans-serif`
  const IN = `font-family:'Inter',Helvetica,Arial,sans-serif`
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cuenta programada para eliminación</title></head>
    <body style="margin:0;padding:0;background:#EBF0F6">
      <div style="max-width:560px;margin:40px auto;padding:0 16px">

        <!-- Logo -->
        <div style="text-align:center;margin-bottom:24px">
          <p style="${SG};font-size:18px;font-weight:700;letter-spacing:-0.5px;color:#0D2B3E;margin:0">MEDSCALE AI</p>
          <p style="${IN};font-size:10px;letter-spacing:0.2em;color:#5A9DB5;margin:4px 0 0">FOR HEALTHCARE GROWTH</p>
        </div>

        <!-- Card -->
        <div style="background:#fff;border-radius:24px;padding:40px 36px;border:1px solid #C8D8E4">
          <div style="width:48px;height:48px;background:#FEF3C7;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:20px">
            <span style="font-size:24px">⚠️</span>
          </div>

          <h1 style="${SG};font-size:22px;font-weight:700;color:#0D2B3E;margin:0 0 12px">
            Tu cuenta será eliminada en 24 horas
          </h1>

          <p style="${IN};font-size:15px;color:#4A6B7A;margin:0 0 20px;line-height:1.6">
            Hemos recibido una solicitud de eliminación para la cuenta <strong style="color:#0D2B3E">${orgName}</strong> en MedScale AI.
          </p>

          <div style="background:#FEF9E7;border:1px solid #F59E0B;border-radius:12px;padding:16px 20px;margin-bottom:24px">
            <p style="${IN};font-size:14px;color:#92400E;margin:0;line-height:1.5">
              <strong>Tu cuenta y todos sus datos serán eliminados de forma permanente en 24 horas.</strong>
              Si esto fue un error o no autorizaste esta acción, contáctanos de inmediato.
            </p>
          </div>

          <a href="mailto:soporte@medscale.app?subject=Cancelar eliminación de cuenta - ${encodeURIComponent(orgName)}"
             style="${SG};display:inline-block;background:#215F73;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px;text-decoration:none">
            Contactar soporte ahora →
          </a>

          <p style="${IN};font-size:13px;color:#4A6B7A;margin:24px 0 0;line-height:1.5">
            Si no tienes ninguna duda y quieres continuar con la eliminación, no necesitas hacer nada.
            Tu cuenta se eliminará automáticamente.
          </p>
        </div>

        <!-- Footer -->
        <p style="${IN};font-size:11px;color:#94a3b8;text-align:center;margin:20px 0">
          MedScale AI · soporte@medscale.app · Medellín, Colombia
        </p>
      </div>
    </body>
    </html>
  `
}

// ── Soft delete (24h grace) ───────────────────────────────────────────────────

export async function scheduleOrganizationDeletion(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await assertOrgAllowed(id)
  const admin = createServiceClient()

  try {
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', id)
      .single()

    const { error } = await admin
      .from('organizations')
      .update({ pending_deletion_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    // Fire-and-forget email to owner
    if (org?.name) {
      const owner = await getOrgOwnerEmail(id)
      if (owner?.email) {
        resend.emails.send({
          from:    'soporte@medscale.app',
          to:      owner.email,
          subject: 'Tu cuenta en MedScale AI será eliminada en 24 horas',
          html:    deletionWarningEmail(org.name),
        }).catch(() => {})
      }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Error interno del servidor' }
  }
}

export async function cancelOrganizationDeletion(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await assertOrgAllowed(id)
  const admin = createServiceClient()

  try {
    const { error } = await admin
      .from('organizations')
      .update({ pending_deletion_at: null })
      .eq('id', id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    return { success: true }
  } catch {
    return { success: false, error: 'Error interno del servidor' }
  }
}

export async function processScheduledDeletions(): Promise<{ deleted: number; error?: string }> {
  const scope = await requirePlatformAdminScope()
  if (scope.orgIds !== null) throw new Error('FORBIDDEN')
  return runScheduledDeletions()
}

export async function generateSlug(name: string): Promise<string> {
  await requirePlatformAdmin()
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
