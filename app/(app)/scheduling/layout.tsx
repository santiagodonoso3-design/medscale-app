import type { ReactNode } from 'react'

export default function SchedulingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Agendamiento</p>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">Agenda</h1>
      </div>
      {children}
    </div>
  )
}
