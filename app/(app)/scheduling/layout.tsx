import Link from 'next/link'
import type { ReactNode } from 'react'

export default function SchedulingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Agendamiento interno</p>
            <h1 className="text-3xl font-bold text-slate-900">Módulo de agenda</h1>
            <p className="mt-2 text-slate-600">Configura médicos, disponibilidad y gestiona citas dentro de la clínica.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/scheduling/doctors" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Médicos
            </Link>
            <Link href="/scheduling/availability" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-100">
              Disponibilidad
            </Link>
            <Link href="/scheduling/calendar" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-100">
              Calendario
            </Link>
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
