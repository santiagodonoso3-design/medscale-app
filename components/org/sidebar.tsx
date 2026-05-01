'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, MessageSquare, CalendarDays, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface OrgSidebarProps {
  orgName?: string
  userName?: string
  userEmail?: string
}

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'CRM', href: '/crm', icon: MessageSquare },
  { name: 'Agenda', href: '/scheduling', icon: CalendarDays },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

export function OrgSidebar({ orgName, userName, userEmail }: OrgSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error logging out:', error)
      setIsLoggingOut(false)
    }
  }

  return (
    <aside className="flex h-full min-h-screen w-72 flex-col bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Medscale AI</p>
            <h1 className="text-lg font-bold tracking-tight text-white truncate">{orgName || 'Mi clínica'}</h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 px-6 py-6">
        <div className="rounded-3xl bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Usuario</p>
          <p className="mt-2 text-sm font-semibold text-white truncate">{userName || 'Miembro del equipo'}</p>
          <p className="mt-1 text-xs text-slate-500 truncate">{userEmail || 'Sin email'}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  )
}
