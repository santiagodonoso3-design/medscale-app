import type { ReactNode } from 'react'
import { DoctorsTabs } from '@/components/doctors/doctors-tabs'

export default function DoctorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Gestión</p>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Doctores</h1>
        </div>
        <div className="mt-3 px-6 pb-5">
          <DoctorsTabs />
        </div>
      </div>
      {children}
    </div>
  )
}
