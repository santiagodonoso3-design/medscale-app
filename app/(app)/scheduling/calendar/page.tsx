import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getUserPermissions, canAccess, canEdit } from '@/lib/permissions'
import { CalendarClient } from '@/components/scheduling/calendar-client-fixed'

export default async function CalendarPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const perms = getUserPermissions(session.role, session.permissions)
  if (!canAccess(perms, 'scheduling')) redirect('/dashboard')

  const doctorId = session.role === 'doctor' ? session.doctorId : null

  return <CalendarClient userId={session.user.id} doctorId={doctorId} readOnly={!canEdit(perms, 'scheduling')} />
}
