import { User } from 'lucide-react'
import { DoctorsClient } from '@/components/scheduling/doctors-client'

export default function DoctorsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <User className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Médicos</p>
            <h1 className="text-3xl font-bold text-slate-900">Configuración de médicos</h1>
          </div>
        </div>
        <p className="mt-3 text-slate-600">Crea, edita y activa o desactiva los médicos de tu organización.</p>
      </div>
      <DoctorsClient />
    </div>
  )
}
