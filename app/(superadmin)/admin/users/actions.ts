'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requirePlatformAdminScope } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const VALID_ROLES = ['owner', 'admin', 'support']
const VALID_SCOPES = ['global', 'assigned']

// Toda mutación del equipo exige owner con alcance global (orgIds === null)
async function requireOwnerGlobal(): Promise<string> {
  const s = await requirePlatformAdminScope()
  if (s.role !== 'owner' || s.orgIds !== null) throw new Error('FORBIDDEN')
  return s.adminId
}

export interface PlatformAdminRow {
  id: string
  user_id: string
  email: string
  role: string
  scope: string
  created_at: string
  organization_ids: string[]
  is_self: boolean
}

export async function getPlatformAdmins(): Promise<PlatformAdminRow[] | null> {
  const s = await requirePlatformAdminScope()
  const admin = createServiceClient()

  try {
    const { data: admins, error } = await admin
      .from('platform_admins')
      .select('id, user_id, email, role, scope, created_at')
      .order('created_at', { ascending: true })

    if (error || !admins) return null

    const { data: assignments, error: assignmentsError } = await admin
      .from('platform_admin_organizations')
      .select('platform_admin_id, organization_id')

    if (assignmentsError) return null

    const orgsByAdmin = new Map<string, string[]>()
    for (const a of assignments ?? []) {
      const adminId = a.platform_admin_id as string
      const list = orgsByAdmin.get(adminId) ?? []
      list.push(a.organization_id as string)
      orgsByAdmin.set(adminId, list)
    }

    return admins.map((row) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      email: row.email as string,
      role: row.role as string,
      scope: row.scope as string,
      created_at: row.created_at as string,
      organization_ids: orgsByAdmin.get(row.id as string) ?? [],
      is_self: row.id === s.adminId,
    }))
  } catch {
    return null
  }
}

export async function getAssignableOrganizations(): Promise<{ id: string; name: string }[] | null> {
  await requireOwnerGlobal()
  const admin = createServiceClient()

  try {
    const { data, error } = await admin
      .from('organizations')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) return null
    return (data ?? []).map((o) => ({ id: o.id as string, name: o.name as string }))
  } catch {
    return null
  }
}

export async function promoteUserToAdmin(
  email: string,
  role: string,
  scope: string,
  organizationIds: string[]
): Promise<{ success: boolean; error?: string }> {
  await requireOwnerGlobal()

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return { success: false, error: 'El correo es obligatorio' }
  if (!VALID_ROLES.includes(role)) return { success: false, error: 'Rol inválido' }
  if (!VALID_SCOPES.includes(scope)) return { success: false, error: 'Alcance inválido' }
  if (scope === 'assigned' && organizationIds.length === 0) {
    return { success: false, error: 'Selecciona al menos una clínica' }
  }

  const admin = createServiceClient()

  try {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) return { success: false, error: 'Error consultando usuarios' }

    const authUser = usersData.users.find((u) => u.email?.toLowerCase() === normalizedEmail)

    // userId se resuelve por dos vías: cuenta existente o creada aquí mismo.
    // La bandera decide el rollback: solo se elimina la cuenta si la creó esta llamada.
    let userId: string
    let userWasCreated = false

    if (authUser) {
      userId = authUser.id
    } else {
      // email_confirm es obligatorio: sin él, al entrar con Google, Supabase
      // no enlaza la identidad al usuario existente y duplica cuentas.
      // Sin password: el acceso es por Google.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
      })
      if (createErr || !created?.user) {
        return { success: false, error: 'No se pudo crear la cuenta: ' + (createErr?.message ?? 'error desconocido') }
      }
      userId = created.user.id
      userWasCreated = true
    }

    const { data: inserted, error: insertError } = await admin
      .from('platform_admins')
      .insert({ user_id: userId, email: normalizedEmail, role, scope })
      .select('id')
      .single()

    if (insertError || !inserted) {
      if (userWasCreated) await admin.auth.admin.deleteUser(userId)
      if (insertError?.code === '23505') {
        return { success: false, error: 'Ese usuario ya es administrador' }
      }
      return { success: false, error: insertError?.message || 'Error creando administrador' }
    }

    if (scope === 'assigned') {
      const { error: assignError } = await admin
        .from('platform_admin_organizations')
        .insert(organizationIds.map((orgId) => ({
          platform_admin_id: inserted.id,
          organization_id: orgId,
        })))

      if (assignError) {
        // No puede quedar un admin 'assigned' sin asignaciones
        await admin.from('platform_admins').delete().eq('id', inserted.id)
        if (userWasCreated) await admin.auth.admin.deleteUser(userId)
        return { success: false, error: assignError.message || 'Error asignando clínicas' }
      }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch {
    return { success: false, error: 'Error interno del servidor' }
  }
}

export async function updateAdminAccess(
  adminId: string,
  role: string,
  scope: string,
  organizationIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const selfId = await requireOwnerGlobal()
  if (adminId === selfId) {
    return { success: false, error: 'No puedes modificar tu propio acceso' }
  }

  if (!VALID_ROLES.includes(role)) return { success: false, error: 'Rol inválido' }
  if (!VALID_SCOPES.includes(scope)) return { success: false, error: 'Alcance inválido' }
  if (scope === 'assigned' && organizationIds.length === 0) {
    return { success: false, error: 'Selecciona al menos una clínica' }
  }

  const admin = createServiceClient()

  try {
    const { data: target } = await admin
      .from('platform_admins')
      .select('id, role, scope')
      .eq('id', adminId)
      .single()

    if (!target) return { success: false, error: 'Administrador no encontrado' }

    const wasOwnerGlobal = target.role === 'owner' && target.scope === 'global'
    const staysOwnerGlobal = role === 'owner' && scope === 'global'
    if (wasOwnerGlobal && !staysOwnerGlobal) {
      const { count } = await admin
        .from('platform_admins')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('scope', 'global')
        .neq('id', adminId)

      if (!count) return { success: false, error: 'Debe quedar al menos un owner global' }
    }

    const { error: updateError } = await admin
      .from('platform_admins')
      .update({ role, scope })
      .eq('id', adminId)

    if (updateError) return { success: false, error: updateError.message }

    // El alcance global no se expresa con asignaciones: se limpian siempre
    // y solo se reinsertan cuando el scope es 'assigned'
    const { error: deleteError } = await admin
      .from('platform_admin_organizations')
      .delete()
      .eq('platform_admin_id', adminId)

    if (deleteError) return { success: false, error: deleteError.message }

    if (scope === 'assigned') {
      const { error: assignError } = await admin
        .from('platform_admin_organizations')
        .insert(organizationIds.map((orgId) => ({
          platform_admin_id: adminId,
          organization_id: orgId,
        })))

      if (assignError) return { success: false, error: assignError.message }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch {
    return { success: false, error: 'Error interno del servidor' }
  }
}

export async function revokeAdmin(adminId: string): Promise<{ success: boolean; error?: string }> {
  const selfId = await requireOwnerGlobal()
  if (adminId === selfId) {
    return { success: false, error: 'No puedes revocar tu propio acceso' }
  }

  const admin = createServiceClient()

  try {
    const { data: target } = await admin
      .from('platform_admins')
      .select('id, role, scope')
      .eq('id', adminId)
      .single()

    if (!target) return { success: false, error: 'Administrador no encontrado' }

    if (target.role === 'owner' && target.scope === 'global') {
      const { count } = await admin
        .from('platform_admins')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('scope', 'global')
        .neq('id', adminId)

      if (!count) return { success: false, error: 'Debe quedar al menos un owner global' }
    }

    // Las asignaciones caen por ON DELETE CASCADE; la cuenta de auth.users
    // y sus membresías en organization_members no se tocan
    const { error: deleteError } = await admin
      .from('platform_admins')
      .delete()
      .eq('id', adminId)

    if (deleteError) return { success: false, error: deleteError.message }

    revalidatePath('/admin/users')
    return { success: true }
  } catch {
    return { success: false, error: 'Error interno del servidor' }
  }
}
