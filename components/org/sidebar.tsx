'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ContactRound, CalendarDays, Settings, LogOut,
  Stethoscope, Users, MessageCircle, User, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface OrgSidebarProps {
  orgName?: string
  userName?: string
  userEmail?: string
  userRole?: 'owner' | 'staff' | 'doctor' | null
  logoUrl?: string | null
  sidebarTheme?: 'dark' | 'light'
}

const ALL_NAV_ITEMS = [
  { name: 'Dashboard',      href: '/dashboard',           icon: LayoutDashboard, roles: ['owner', 'staff'] },
  { name: 'CRM',            href: '/crm',                 icon: ContactRound,    roles: ['owner', 'staff'] },
  { name: 'Agenda',         href: '/scheduling/calendar', icon: CalendarDays,    roles: ['owner', 'staff', 'doctor'] },
  { name: 'Conversaciones', href: '/conversations',       icon: MessageCircle,   roles: ['owner', 'staff'] },
  { name: 'Doctores',       href: '/doctors',             icon: Stethoscope,     roles: ['owner', 'staff', 'doctor'] },
  { name: 'Equipo',         href: '/team',                icon: Users,           roles: ['owner'] },
  { name: 'Configuración',  href: '/settings',            icon: Settings,        roles: ['owner'] },
]

export function OrgSidebar({ orgName, userName, userEmail, userRole, logoUrl, sidebarTheme }: OrgSidebarProps) {
  const navItems = ALL_NAV_ITEMS.filter(item =>
    !userRole || item.roles.includes(userRole)
  )
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const supabase = createClient()

  const isDark = sidebarTheme !== 'light'
  const theme = {
    bg:         isDark ? 'bg-foreground'                    : 'bg-[#F3F7FA]',
    text:       isDark ? 'text-white'                       : 'text-[#0D2B3E]',
    textMuted:  isDark ? 'text-white/60'                    : 'text-[#4A6B7A]',
    textLabel:  isDark ? 'text-white/40'                    : 'text-[#4A6B7A]/60',
    activeItem: isDark ? 'bg-primary text-white shadow-sm'  : 'bg-[#215F73] text-white shadow-sm',
    hoverItem:  isDark ? 'hover:bg-primary/20 hover:text-white' : 'hover:bg-[#215F73]/10 hover:text-[#0D2B3E]',
    border:     isDark ? 'border-primary/30'                : 'border-[#C8D8E4]',
    accentText: isDark ? 'text-accent'                      : 'text-[#215F73]',
    iconBg:     isDark ? 'bg-accent text-white'             : 'bg-[#215F73]/10 text-[#215F73]',
    toggleBtn:  isDark ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-[#4A6B7A] hover:text-[#0D2B3E] hover:bg-[#215F73]/10',
    accountBtn: isDark ? 'border-white/10 text-white/60 hover:bg-white/10' : 'border-[#C8D8E4] text-[#4A6B7A] hover:bg-[#215F73]/10',
  }

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

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
    <aside className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto transition-all duration-200 ${theme.bg} ${theme.text} ${collapsed ? 'w-14' : 'w-56'}`}>

      {/* Logo */}
      <div className={`border-b ${theme.border} py-5 ${collapsed ? 'px-2 flex justify-center' : 'px-5'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
          ) : (
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}>
              <LayoutDashboard className="h-4 w-4" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Medscale AI</p>
              <h1 className={`text-sm font-bold tracking-tight truncate ${theme.text}`}>{orgName || 'Mi clínica'}</h1>
            </div>
          )}
        </div>
      </div>

      {/* Toggle button */}
      <div className="flex items-center justify-between px-4 py-2">
        {!collapsed && <span className={`text-xs ${theme.textLabel}`}>MENÚ</span>}
        <button
          onClick={toggleCollapsed}
          className={`p-1.5 rounded-lg transition ${theme.toggleBtn} ${collapsed ? 'mx-auto' : 'ml-auto'}`}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 space-y-0.5 py-4 ${collapsed ? 'px-1' : 'px-3'}`}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/scheduling/calendar'
              ? pathname.startsWith('/scheduling')
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                className={`flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  isActive
                    ? theme.activeItem
                    : `${theme.textMuted} ${theme.hoverItem}`
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: '18px', height: '18px' }} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
              {/* Tooltip when collapsed — always dark */}
              {collapsed && (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                  {item.name}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Mi cuenta */}
      <div className="relative">
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-2 right-2 mb-1 z-50 rounded-xl border border-slate-200 bg-white shadow-lg py-1 overflow-hidden">
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
        <div className="group relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className={`flex w-full items-center border-t py-3 text-sm transition ${theme.accountBtn} ${
              collapsed ? 'justify-center px-0' : 'gap-2 px-4'
            }`}
          >
            <User className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Mi cuenta</span>
                <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
          {collapsed && (
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
              Mi cuenta
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
