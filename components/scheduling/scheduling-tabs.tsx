'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/scheduling/calendar', label: 'Calendario' },
]

export function SchedulingTabs() {
  const pathname = usePathname()

  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
      {TABS.map(({ href, label }) => {
        const isActive =
          pathname === href ||
          pathname.startsWith(href + '/') ||
          (href === '/scheduling/calendar' && pathname === '/scheduling')

        return (
          <Link
            key={href}
            href={href}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
