import { createServiceClient } from '@/lib/supabase/server'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return jsonResponse({ success: false, error: 'Endpoint disponible solo en desarrollo' }, 404)
  }

  const organizationId = '03581ed6-bc68-4ac3-a6a0-359a5b45a95d'
  const email = 'admin@clinica.com'
  const password = 'test1234'

  const supabase = createServiceClient()

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .single()

  if (orgError || !org) {
    return jsonResponse({ success: false, error: 'Organización de prueba no encontrada' }, 404)
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return jsonResponse({ success: false, error: authError?.message || 'Error creando usuario Auth' }, 500)
    }

    const userId = authData.user.id

    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      organization_id: organizationId,
      role: 'org_admin',
      first_name: 'Admin',
      last_name: 'Clínica',
      is_active: true,
    })

    if (userError) {
      await supabase.auth.admin.deleteUser(userId)
      return jsonResponse({ success: false, error: userError.message }, 500)
    }

    return jsonResponse({ success: true, user_id: userId })
  } catch (error) {
    console.error('Error creating test org_admin:', error)
    return jsonResponse({ success: false, error: 'Error interno creando usuario de prueba' }, 500)
  }
}
