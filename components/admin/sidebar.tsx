'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Users, Settings, LogOut, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface AdminSidebarProps {
  userEmail?: string
  userName?: string
}

const navItems = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    name: 'Organizaciones',
    href: '/admin/organizations',
    icon: Building2,
  },
  {
    name: 'Usuarios',
    href: '/admin/users',
    icon: Users,
  },
  {
    name: 'Configuración',
    href: '/admin/settings',
    icon: Settings,
  },
]

export function AdminSidebar({ userEmail, userName }: AdminSidebarProps) {
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
    <div className="flex flex-col h-full bg-slate-950 text-white w-64">
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-bold">Medscale AI</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">Panel de Superadmin</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="px-4 py-3 bg-slate-900 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Usuario</p>
          <p className="text-sm font-medium truncate">{userName || 'Superadmin'}</p>
          <p className="text-xs text-slate-500 truncate mt-1">{userEmail}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  )
}
