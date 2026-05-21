import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getUserPermissions, canAccess, canEdit } from '@/lib/permissions'
import { DoctorsPageClient } from '@/components/doctors/doctors-page-client'

export default async function DoctorsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const perms = getUserPermissions(session.role, session.permissions)
  if (!canAccess(perms, 'doctors')) redirect('/dashboard')

  return (
    <div className="p-6 xl:p-10">
      <DoctorsPageClient
        isDoctor={session.role === 'doctor'}
        userDoctorId={session.doctorId}
        orgId={session.orgId}
        readOnly={!canEdit(perms, 'doctors')}
      />
    </div>
  )
}
