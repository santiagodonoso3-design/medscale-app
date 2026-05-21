export const dynamic    = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { unstable_noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getUserPermissions, canAccess } from '@/lib/permissions'
import { getDashboardRawData, getDashboardYears } from './actions'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  unstable_noStore()

  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.orgId) redirect('/onboarding')

  const perms = getUserPermissions(session.role, session.permissions)
  if (!canAccess(perms, 'dashboard')) redirect('/scheduling/calendar')

  const admin = createServiceClient()
  const { data: org } = await admin
    .from('organizations')
    .select('onboarding_completed')
    .eq('id', session.orgId)
    .single()

  if (!org?.onboarding_completed) redirect('/onboarding')

  const currentYear = Number(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'America/Bogota' }).format(new Date())
  )

  const [rawData, availableYears] = await Promise.all([
    getDashboardRawData(currentYear, session.orgId),
    getDashboardYears(session.orgId),
  ])

  if (!rawData) {
    return (
      <div className="p-6 xl:p-10">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
          <p className="text-sm text-red-700">Error cargando el dashboard.</p>
        </div>
      </div>
    )
  }

  if (rawData.appointments.length === 0 && rawData.yearLeads.length === 0) {
    return (
      <div className="p-6 xl:p-10 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-2xl bg-[#EBF0F6] p-3">
            <LayoutDashboard className="h-12 w-12 text-[#5A9DB5]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[#0D2B3E]">Tu dashboard se llenará pronto</h2>
            <p className="text-sm text-[#4A6B7A] max-w-sm">Cuando tengas citas y leads, aquí verás las métricas de tu clínica.</p>
          </div>
          <Link
            href="/scheduling/calendar"
            className="rounded-xl bg-[#215F73] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2B3E]"
          >
            Agendar primera cita
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 xl:p-10">
      <DashboardClient initialData={rawData} availableYears={availableYears} orgId={session.orgId} />
    </div>
  )
}
