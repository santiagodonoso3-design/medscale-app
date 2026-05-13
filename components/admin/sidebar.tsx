'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Users, Settings, LogOut, BarChart3, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { startImpersonation } from '@/lib/admin/impersonate'

interface AdminSidebarProps {
  userEmail?: string
  userName?: string
  allOrganizations?: { id: string; name: string; logo_url: string | null }[]
}

const navItems = [
  { name: 'Dashboard',       href: '/admin',               icon: LayoutDashboard },
  { name: 'Organizaciones',  href: '/admin/organizations', icon: Building2 },
  { name: 'Usuarios',        href: '/admin/users',         icon: Users },
  { name: 'Configuración',   href: '/admin/settings',      icon: Settings },
]

export function AdminSidebar({ userEmail, userName, allOrganizations = [] }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
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
      <div className="p-6 border-b border-slate-800 relative">
        <button
          onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
          className="w-full flex items-center justify-between hover:opacity-80 transition"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-left">Medscale AI</h1>
              <p className="text-xs text-slate-400 mt-0.5 text-left">Panel de Superadmin</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {orgDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOrgDropdownOpen(false)} />
            <div className="absolute left-2 right-2 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-lg py-1 max-h-64 overflow-y-auto">
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Organizaciones</div>
              {allOrganizations.map(org => (
                <button
                  key={org.id}
                  onClick={async () => {
                    setOrgDropdownOpen(false)
                    await startImpersonation(org.id)
                    router.push('/dashboard')
                    router.refresh()
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition"
                >
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="h-8 w-8 shrink-0 rounded-lg object-contain" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                      <span className="text-xs font-bold text-slate-500">{org.name[0]}</span>
                    </div>
                  )}
                  <p className="text-sm font-medium text-slate-900 truncate">{org.name}</p>
                </button>
              ))}
            </div>
          </>
        )}
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
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
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
