import { Users } from 'lucide-react'

export default function UsersPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Usuarios del Sistema</h1>
        <p className="text-slate-600">Gestiona los usuarios globales del sistema Medscale AI</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-1">
          Próximamente
        </h3>
        <p className="text-slate-600">
          La gestión de usuarios del sistema estará disponible pronto
        </p>
      </div>
    </div>
  )
}
