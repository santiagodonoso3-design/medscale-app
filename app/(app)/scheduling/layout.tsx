import type { ReactNode } from 'react'
import { SchedulingTabs } from '@/components/scheduling/scheduling-tabs'

export default function SchedulingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Agendamiento interno
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Módulo de agenda</h1>
        </div>
        <div className="mt-4 px-6">
          <SchedulingTabs />
        </div>
      </div>
      {children}
    </div>
  )
}
