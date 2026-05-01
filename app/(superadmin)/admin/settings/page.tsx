import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Configuración</h1>
        <p className="text-slate-600">Configuración global del sistema Medscale AI</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <Settings className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-1">
          Próximamente
        </h3>
        <p className="text-slate-600">
          La configuración del sistema estará disponible pronto
        </p>
      </div>
    </div>
  )
}
