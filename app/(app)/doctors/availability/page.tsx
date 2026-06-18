import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getUserPermissions, canAccess, getFirstAccessibleRoute } from '@/lib/permissions'
import { AvailabilityEditor } from '@/components/doctors/availability-editor'

export default async function DoctorsAvailabilityPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const perms = getUserPermissions(session.role, session.permissions)
  if (!canAccess(perms, 'doctors')) redirect(getFirstAccessibleRoute(perms))

  return <AvailabilityEditor orgId={session.orgId} />
}
