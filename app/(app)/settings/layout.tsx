import type { ReactNode } from 'react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SettingsNav } from './settings-nav'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const admin = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  let isDoctor = false
  if (user) {
    const { data: member } = await admin
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .single()
    isDoctor = member?.role === 'doctor'
  }

  return (
    <div className="p-6 xl:p-10 flex gap-6 min-h-screen">
      <SettingsNav isDoctor={isDoctor} />
      <main className="flex-1 min-w-0">
        <div className="rounded-3xl border bg-white shadow-sm p-8" style={{ borderColor: '#C8D8E4' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
