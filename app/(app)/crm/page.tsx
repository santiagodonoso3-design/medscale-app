import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getUserPermissions, canAccess, canEdit, getFirstAccessibleRoute } from '@/lib/permissions'
import CrmPage from './crm-client'

export default async function CrmServerPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const perms = getUserPermissions(session.role, session.permissions)
  if (!canAccess(perms, 'crm')) redirect(getFirstAccessibleRoute(perms))

  return <CrmPage readOnly={!canEdit(perms, 'crm')} />
}
