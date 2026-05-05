export const dynamic   = 'force-dynamic'
export const revalidate = 0

import { getDashboardRawData, getDashboardYears } from './actions'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const currentYear = Number(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'America/Bogota' }).format(new Date())
  )

  const [rawData, availableYears] = await Promise.all([
    getDashboardRawData(currentYear),
    getDashboardYears(),
  ])

  if (!rawData) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
        <p className="text-sm text-red-700">Error cargando el dashboard.</p>
      </div>
    )
  }

  return <DashboardClient initialData={rawData} availableYears={availableYears} />
}
