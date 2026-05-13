'use server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

const COOKIE_NAME = 'impersonate_org_id'

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('platform_admins')
    .select('id')
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function startImpersonation(orgId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const isAdmin = await isPlatformAdmin(user.id)
  if (!isAdmin) return { success: false, error: 'No autorizado' }

  const admin = createServiceClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .single()
  if (!org) return { success: false, error: 'Organización no encontrada' }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4, // 4 horas máximo
  })

  return { success: true }
}

export async function stopImpersonation() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getImpersonatedOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}
