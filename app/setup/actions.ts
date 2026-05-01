'use server'

import { createClient } from '@supabase/supabase-js'

type SetupResult =
  | { success: true; userId: string; email: string }
  | { success: false; error: string }

export async function createFirstSuperadmin(
  _prev: SetupResult | null,
  formData: FormData
): Promise<SetupResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!email || !password) {
    return { success: false, error: 'Email y contraseña son requeridos.' }
  }
  if (password !== confirm) {
    return { success: false, error: 'Las contraseñas no coinciden.' }
  }
  if (password.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // One-time protection: abort if a superadmin already exists
  const { data: existing, error: checkError } = await admin
    .from('superadmins')
    .select('id')
    .limit(1)

  if (checkError) {
    return { success: false, error: `Error verificando tabla superadmins: ${checkError.message}` }
  }
  if (existing && existing.length > 0) {
    return {
      success: false,
      error: 'Ya existe un superadmin. Esta página está deshabilitada.',
    }
  }

  // Create user in auth.users (email already confirmed)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Error creando usuario en Auth.' }
  }

  const userId = authData.user.id

  // Create a default organization for the superadmin
  const { data: orgData, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: 'Medscale',
      slug: 'medscale',
      metadata: { created_by_setup: true }
    })
    .select('id')
    .single()

  if (orgError || !orgData) {
    await admin.auth.admin.deleteUser(userId)
    return { success: false, error: `Error creando organización: ${orgError?.message ?? 'Unknown error'}` }
  }

  const organizationId = orgData.id

  // Create user record manually since trigger might not be working
  const { error: userError } = await admin.from('users').insert({
    id: userId,
    organization_id: organizationId,
    role: 'superadmin',
    first_name: 'Super',
    last_name: 'Admin',
  })

  if (userError) {
    await admin.auth.admin.deleteUser(userId)
    return { success: false, error: `Error creando usuario: ${userError.message}` }
  }

  // Insert into superadmins table
  const { error: superError } = await admin.from('superadmins').insert({
    user_id: userId,
  })

  if (superError) {
    await admin.auth.admin.deleteUser(userId)
    return { success: false, error: `Error en tabla superadmins: ${superError.message}` }
  }

  return { success: true, userId, email }
}
