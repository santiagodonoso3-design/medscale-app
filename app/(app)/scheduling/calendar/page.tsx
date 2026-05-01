import { CalendarDays, Clock3, Users } from 'lucide-react'
import { CalendarClient } from '@/components/scheduling/calendar-client-fixed'

export default function CalendarPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <CalendarDays className="h-5 w-5 text-violet-600" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Agenda semanal</p>
            <h1 className="text-3xl font-bold text-slate-900">Panel de citas</h1>
          </div>
        </div>
        <p className="mt-3 text-slate-600">Visualiza las citas de la semana, filtra por médico y crea nuevas reservas.</p>
      </div>
      <CalendarClient />
    </div>
  )
}
