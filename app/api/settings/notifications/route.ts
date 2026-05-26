import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.orgId) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (session.role !== 'owner') {
    return Response.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { contact_email } = await request.json() as { contact_email?: string }

  const admin = createServiceClient()
  const { error } = await admin
    .from('organizations')
    .update({ contact_email: contact_email ?? null })
    .eq('id', session.orgId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
