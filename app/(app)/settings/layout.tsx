import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { SettingsNav } from './settings-nav'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  const { role } = session

  if (role !== 'owner') {
    if (role !== 'doctor' || !pathname.startsWith('/settings/integrations')) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="p-6 xl:p-10 flex gap-6 min-h-screen">
      <SettingsNav isDoctor={role === 'doctor'} />
      <main className="flex-1 min-w-0">
        <div className="rounded-3xl border bg-white shadow-sm p-8" style={{ borderColor: '#C8D8E4' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
