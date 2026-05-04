import { Users } from 'lucide-react'

export default function TeamPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Organización</p>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">Equipo</h1>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-700">Próximamente</p>
            <p className="mt-1 text-sm text-slate-500">
              Gestión de equipo y roles — invita usuarios, asigna roles y controla permisos por organización.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
