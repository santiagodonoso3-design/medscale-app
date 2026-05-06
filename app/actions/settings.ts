'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: member } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!member?.organization_id) return null

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, primary_color, logo_url')
    .eq('id', member.organization_id)
    .single()

  return org
}

export async function uploadOrgLogo(orgId: string, formData: FormData): Promise<string | null> {
  const file = formData.get('file') as File
  if (!file) return null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const ext = file.name.split('.').pop()
  const path = `logos/${orgId}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from('organizations')
    .upload(path, buffer, { upsert: true, contentType: file.type })

  if (error) { console.error('[uploadOrgLogo]', error); return null }

  const { data } = admin.storage.from('organizations').getPublicUrl(path)
  return data.publicUrl
}
