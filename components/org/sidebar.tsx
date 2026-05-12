'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, MessageSquare, CalendarDays, Settings, LogOut, Stethoscope, Users, MessageCircle, ChevronUp, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface OrgSidebarProps {
  orgName?: string
  userName?: string
  userEmail?: string
  userRole?: 'owner' | 'staff' | 'doctor' | null
}

const ALL_NAV_ITEMS = [
  { name: 'Dashboard',      href: '/dashboard',           icon: LayoutDashboard, roles: ['owner', 'staff'] },
  { name: 'CRM',            href: '/crm',                 icon: MessageSquare,   roles: ['owner', 'staff'] },
  { name: 'Agenda',         href: '/scheduling/calendar', icon: CalendarDays,    roles: ['owner', 'staff', 'doctor'] },
  { name: 'Conversaciones', href: '/conversations',       icon: MessageCircle,   roles: ['owner', 'staff'] },
  { name: 'Doctores',       href: '/doctors',             icon: Stethoscope,     roles: ['owner', 'staff', 'doctor'] },
  { name: 'Equipo',         href: '/team',                icon: Users,           roles: ['owner'] },
  { name: 'Configuración',  href: '/settings',            icon: Settings,        roles: ['owner'] },
  { name: 'Integraciones',  href: '/settings/integrations', icon: Settings,      roles: ['owner', 'doctor'] },
]

export function OrgSidebar({ orgName, userName, userEmail, userRole }: OrgSidebarProps) {
  const navItems = ALL_NAV_ITEMS.filter(item =>
    !userRole || item.roles.includes(userRole)
  )
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col overflow-y-auto bg-foreground text-primary-foreground">
      <div className="border-b border-primary/30 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Medscale AI</p>
            <h1 className="text-lg font-bold tracking-tight text-white truncate">{orgName || 'Mi clínica'}</h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/scheduling/calendar'
              ? pathname.startsWith('/scheduling')
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-white/60 hover:bg-primary/20 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="relative border-t border-primary/30">
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-0 w-full z-20 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden mb-1">
              {/* Info section — non-clickable */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900 truncate">{userName || 'Miembro del equipo'}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{userEmail || 'Sin email'}</p>
                {userRole && (
                  <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    userRole === 'owner'  ? 'bg-blue-100 text-blue-700' :
                    userRole === 'doctor' ? 'bg-purple-100 text-purple-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {userRole === 'owner' ? 'Admin' : userRole === 'doctor' ? 'Médico' : 'Colaborador'}
                  </span>
                )}
              </div>
              {/* Logout */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
              </button>
            </div>
          </>
        )}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/60 hover:bg-primary/20 hover:text-white transition"
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Mi cuenta</span>
          <ChevronUp className={`h-3 w-3 shrink-0 transition-transform ${menuOpen ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </aside>
  )
}
