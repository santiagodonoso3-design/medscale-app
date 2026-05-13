'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'free' | 'starter' | 'growth' | 'scale'
  is_active: boolean
  user_count: number
  created_at: string
}

export async function getAllOrganizations(): Promise<Organization[] | null> {
  const supabase = await createClient()

  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, slug, metadata, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching organizations:', error)
      return null
    }

    // Get user counts per organization
    const organizationsWithData = await Promise.all(
      (orgs || []).map(async (org) => {
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)

        const metadata = org.metadata as Record<string, any> || {}

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: (metadata.plan || 'starter') as 'free' | 'starter' | 'growth' | 'scale',
          is_active: metadata.is_active !== false,
          user_count: count || 0,
          created_at: org.created_at,
        }
      })
    )

    return organizationsWithData
  } catch (error) {
    console.error('Error in getAllOrganizations:', error)
    return null
  }
}

export async function createOrganization(
  name: string,
  slug: string,
  plan: 'free' | 'starter' | 'growth' | 'scale'
): Promise<{ success: boolean; error?: string; organization?: Organization }> {
  const supabase = await createClient()

  try {
    // Check if slug already exists
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return { success: false, error: 'El slug ya está en uso' }
    }

    // Create organization
    const { data: newOrg, error } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        metadata: {
          plan,
          is_active: true,
          created_by: 'superadmin',
        },
      })
      .select('id, name, slug, metadata, created_at')
      .single()

    if (error || !newOrg) {
      console.error('Error creating organization:', error)
      return { success: false, error: error?.message || 'Error creando organización' }
    }

    const metadata = newOrg.metadata as Record<string, any> || {}

    const organization: Organization = {
      id: newOrg.id,
      name: newOrg.name,
      slug: newOrg.slug,
      plan: (metadata.plan || 'starter') as 'free' | 'starter' | 'growth' | 'scale',
      is_active: metadata.is_active !== false,
      user_count: 0,
      created_at: newOrg.created_at,
    }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    return { success: true, organization }
  } catch (error) {
    console.error('Error in createOrganization:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

export async function updateOrganization(
  id: string,
  name: string,
  slug: string,
  plan: 'free' | 'starter' | 'growth' | 'scale',
  is_active: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        name,
        slug,
        metadata: {
          plan,
          is_active,
        },
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating organization:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('Error in updateOrganization:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

export async function deleteOrganization(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting organization:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('Error in deleteOrganization:', error)
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
