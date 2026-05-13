'use client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function ImpersonationBanner({ orgName }: { orgName: string }) {
  const router = useRouter()

  const handleStop = async () => {
    const { stopImpersonation } = await import('@/lib/admin/impersonate')
    await stopImpersonation()
    router.push('/admin/organizations')
    router.refresh()
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-3 z-50">
      <span>Estás viendo como: <strong>{orgName}</strong></span>
      <button
        onClick={handleStop}
        className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1 text-xs font-semibold transition"
      >
        <LogOut className="h-3 w-3" />
        Salir
      </button>
    </div>
  )
}
