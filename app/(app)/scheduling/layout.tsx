'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_TABS = [
  { label: 'Calendario',     href: '/scheduling/calendar' },
  { label: 'Tipos de cita',  href: '/scheduling/appointment-types' },
]

export default function SchedulingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Agendamiento</p>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">Agenda</h1>
        <div className="border-t border-slate-100 mt-4 -mx-6 px-6">
          <div className="flex gap-6">
            {NAV_TABS.map(tab => {
              const isActive = pathname.startsWith(tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'px-1 py-3 text-sm transition inline-block border-b-2',
                    isActive
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
