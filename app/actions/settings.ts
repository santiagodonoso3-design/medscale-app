'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrgIdFromUser } from '@/lib/get-org-id'
import { requireOrgContext } from '@/lib/auth/session'

export async function getOrgSettings() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const orgId = await getOrgIdFromUser(user.id)
  if (!orgId) return null

  const admin = createServiceClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, primary_color, logo_url, sidebar_theme')
    .eq('id', orgId)
    .single()

  return org
}

export async function uploadOrgLogo(
  base64: string,
  fileName: string,
  contentType: string
): Promise<string | null> {
  const { orgId } = await requireOrgContext()
  const admin = createServiceClient()

  // Path is built from the session-derived orgId only — never client input —
  // so a caller can't overwrite another org's logo via a crafted path.
  const ext = (fileName.split('.').pop() ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png'
  const path = `logos/${orgId}.${ext}`
  const buffer = Buffer.from(base64, 'base64')

  const { error } = await admin.storage
    .from('organizations')
    .upload(path, buffer, { upsert: true, contentType })

  if (error) return null

  const { data } = admin.storage.from('organizations').getPublicUrl(path)
  return data.publicUrl
}

export async function saveOrgSettings(data: {
  name?: string
  primary_color?: string
  logo_url?: string | null
  sidebar_theme?: 'dark' | 'light'
}) {
  const { orgId } = await requireOrgContext()
  const admin = createServiceClient()
  const { error } = await admin
    .from('organizations')
    .update(data)
    .eq('id', orgId)
  return !error
}
