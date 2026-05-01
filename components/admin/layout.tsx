'use client'

import { AdminSidebar } from './sidebar'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserEmail(user.email || '')
          setUserName(user.user_metadata?.name || '')
        }
      } catch (error) {
        console.error('Error loading user info:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserInfo()
  }, [supabase])

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 mb-4"></div>
            <p className="text-sm text-slate-600">Cargando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <AdminSidebar userEmail={userEmail} userName={userName} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
