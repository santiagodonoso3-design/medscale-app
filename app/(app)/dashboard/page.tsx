export const dynamic = 'force-dynamic'

import { getDashboardData } from './actions'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const data = await getDashboardData()

  if (!data) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
        <p className="text-sm text-red-700">Error cargando el dashboard.</p>
      </div>
    )
  }

  return <DashboardClient data={data} />
}
