'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getOrgIdFromUser } from '@/lib/get-org-id'

export async function getOrgSettings() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const orgId = await getOrgIdFromUser(user.id)
  if (!orgId) return null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, primary_color, logo_url')
    .eq('id', orgId)
    .single()

  return org
}

export async function uploadOrgLogo(
  orgId: string,
  base64: string,
  fileName: string,
  contentType: string
): Promise<string | null> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const ext = fileName.split('.').pop()
  const path = `logos/${orgId}.${ext}`
  const buffer = Buffer.from(base64, 'base64')

  const { error } = await admin.storage
    .from('organizations')
    .upload(path, buffer, { upsert: true, contentType })

  if (error) { console.error('[uploadOrgLogo]', error); return null }

  const { data } = admin.storage.from('organizations').getPublicUrl(path)
  return data.publicUrl
}

export async function saveOrgSettings(orgId: string, data: {
  name?: string
  primary_color?: string
  logo_url?: string | null
}) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { error } = await admin
    .from('organizations')
    .update(data)
    .eq('id', orgId)
  return !error
}
