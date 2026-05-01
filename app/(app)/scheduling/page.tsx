import Link from 'next/link'
import { CalendarDays, LayoutDashboard, Sparkles, User } from 'lucide-react'

export default async function SchedulingPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Agenda</p>
            <h1 className="text-3xl font-bold text-slate-900">Control de citas y disponibilidad</h1>
            <p className="mt-2 text-slate-600">Administra médicos, horarios y crea citas manuales para tu clínica.</p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-3xl bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Módulo de agendamiento interno
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Link href="/scheduling/doctors" className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-blue-400 hover:shadow-sm">
          <div className="flex items-center gap-3 text-slate-900">
            <User className="h-5 w-5 text-blue-600" />
            <p className="text-lg font-semibold">Médicos</p>
          </div>
          <p className="mt-4 text-sm text-slate-600">Lista de médicos y configuración de perfiles clínicos.</p>
        </Link>

        <Link href="/scheduling/availability" className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-blue-400 hover:shadow-sm">
          <div className="flex items-center gap-3 text-slate-900">
            <LayoutDashboard className="h-5 w-5 text-emerald-600" />
            <p className="text-lg font-semibold">Disponibilidad</p>
          </div>
          <p className="mt-4 text-sm text-slate-600">Define días, horarios, sedes y consultorios por médico.</p>
        </Link>

        <Link href="/scheduling/calendar" className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-blue-400 hover:shadow-sm">
          <div className="flex items-center gap-3 text-slate-900">
            <CalendarDays className="h-5 w-5 text-violet-600" />
            <p className="text-lg font-semibold">Calendario</p>
          </div>
          <p className="mt-4 text-sm text-slate-600">Agenda semanal con citas, estado y creación rápida.</p>
        </Link>
      </div>
    </div>
  )
}
