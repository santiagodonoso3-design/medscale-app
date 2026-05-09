'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SettingsNavProps {
  isDoctor: boolean
}

const ALL_TABS = [
  { label: 'General',        href: '/settings/general' },
  { label: 'Sedes',          href: '/settings/locations' },
  { label: 'Tipos de cita',  href: '/settings/appointment-types' },
  { label: 'Notificaciones', href: '/settings/notifications' },
  { label: 'Integraciones',  href: '/settings/integrations' },
]

const DOCTOR_TABS = [
  { label: 'Integraciones', href: '/settings/integrations' },
]

export function SettingsNav({ isDoctor }: SettingsNavProps) {
  const pathname = usePathname()
  const tabs = isDoctor ? DOCTOR_TABS : ALL_TABS

  return (
    <aside className="w-52 shrink-0">
      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: '#C8D8E4' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#C8D8E4' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: '#4A6B7A' }}>Configuración</p>
        </div>
        <nav className="p-2 space-y-0.5">
          {tabs.map(tab => {
            const isActive = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: isActive ? '#215F73' : 'transparent',
                  color:      isActive ? '#FFFFFF' : '#4A6B7A',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F3F7FA' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
