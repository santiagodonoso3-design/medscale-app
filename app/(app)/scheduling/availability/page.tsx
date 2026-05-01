import { Clock4, MapPin, PersonStanding } from 'lucide-react'
import { AvailabilityClient } from '@/components/scheduling/availability-client'

export default function AvailabilityPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <Clock4 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Disponibilidad</p>
            <h1 className="text-3xl font-bold text-slate-900">Horarios y consultorios</h1>
          </div>
        </div>
        <p className="mt-3 text-slate-600">Define días y franjas horarias disponibles por médico y sede.</p>
      </div>
      <AvailabilityClient />
    </div>
  )
}
