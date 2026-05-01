import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'superadmin' | 'admin' | 'staff'

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return user
}

export async function requireRole(role: UserRole) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== role) {
    redirect(role === 'superadmin' ? '/admin' : '/dashboard')
  }

  return { user, role: userData.role as UserRole }
}

export async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
