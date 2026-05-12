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
    <div className="flex flex-col h-screen">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
        <h1 className="text-base font-semibold text-slate-900">Agenda</h1>
        <div className="flex gap-1">
          {NAV_TABS.map(tab => {
            const isActive = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={isActive
                  ? 'rounded-lg px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white'
                  : 'rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition'}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
