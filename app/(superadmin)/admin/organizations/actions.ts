'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'free' | 'starter' | 'growth' | 'scale'
  is_active: boolean
  ai_agent_enabled: boolean
  monthly_revenue: number
  user_count: number
  created_at: string
}

export async function getAllOrganizations(): Promise<Organization[] | null> {
  const admin = createServiceClient()

  try {
    const { data: orgs, error } = await admin
      .from('organizations')
      .select('id, name, slug, plan, is_active, ai_agent_enabled, monthly_revenue, created_at')
      .order('created_at', { ascending: false })

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
          plan: (org.plan || 'free') as 'free' | 'starter' | 'growth' | 'scale',
          is_active: org.is_active !== false,
          ai_agent_enabled: org.ai_agent_enabled === true,
          monthly_revenue: org.monthly_revenue || 0,
          user_count: count || 0,
          created_at: org.created_at,
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
  plan: 'free' | 'starter' | 'growth' | 'scale'
): Promise<{ success: boolean; error?: string; organization?: Organization }> {
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
      .select('id, name, slug, plan, is_active, ai_agent_enabled, monthly_revenue, created_at')
      .single()

    if (error || !newOrg) {
      return { success: false, error: error?.message || 'Error creando organización' }
    }

    const organization: Organization = {
      id: newOrg.id,
      name: newOrg.name,
      slug: newOrg.slug,
      plan: (newOrg.plan || 'free') as 'free' | 'starter' | 'growth' | 'scale',
      is_active: newOrg.is_active !== false,
      ai_agent_enabled: newOrg.ai_agent_enabled === true,
      monthly_revenue: newOrg.monthly_revenue || 0,
      user_count: 0,
      created_at: newOrg.created_at,
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
  plan: 'free' | 'starter' | 'growth' | 'scale',
  is_active: boolean,
  ai_agent_enabled: boolean,
  monthly_revenue: number
): Promise<{ success: boolean; error?: string }> {
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

export async function deleteOrganization(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createServiceClient()

  try {
    const { error } = await admin
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    return { success: true }
  } catch {
    return { success: false, error: 'Error interno del servidor' }
  }
}

export async function generateSlug(name: string): Promise<string> {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
