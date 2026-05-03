'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Stethoscope, Clock4 } from 'lucide-react'

const TABS = [
  { href: '/scheduling/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/scheduling/doctors', label: 'Médicos', icon: Stethoscope },
  { href: '/scheduling/availability', label: 'Disponibilidad', icon: Clock4 },
]

export function SchedulingTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-0 border-b border-slate-200 -mx-6 px-6">
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href ||
          pathname.startsWith(href + '/') ||
          (href === '/scheduling/calendar' && pathname === '/scheduling')

        return (
          <Link
            key={href}
            href={href}
            className={[
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
