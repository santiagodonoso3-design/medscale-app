'use client'

import { useActionState } from 'react'
import { createFirstSuperadmin } from './actions'
import { ShieldCheck, Loader2, CircleCheck, CircleX } from 'lucide-react'

type SetupResult =
  | { success: true; userId: string; email: string }
  | { success: false; error: string }

export default function SetupPage() {
  const [state, action, isPending] = useActionState<SetupResult | null, FormData>(
    createFirstSuperadmin,
    null
  )

  if (state?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <CircleCheck className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Superadmin creado</h2>
          <p className="text-sm text-gray-500 mb-4">
            <span className="font-medium text-gray-700">{state.email}</span> fue registrado
            correctamente.
          </p>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-left mb-6">
            <p className="text-xs text-gray-500 mb-1">User ID</p>
            <code className="text-xs font-mono text-gray-800 break-all">{state.userId}</code>
          </div>
          <a
            href="/admin"
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition text-center"
          >
            Ir al panel de administración
          </a>
          <p className="mt-4 text-xs text-red-500">
            Elimina o protege esta ruta antes de hacer deploy a producción.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="h-6 w-6 text-blue-600 shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Setup inicial</h1>
              <p className="text-xs text-gray-500">Crear el primer superadmin de Medscale</p>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-6">
            <p className="text-xs text-amber-800">
              Esta página se deshabilita automáticamente una vez que existe un superadmin.
              Elimínala antes de ir a producción.
            </p>
          </div>

          <form action={action} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="off"
                placeholder="admin@medscale.ai"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <input
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {state && !state.success && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <CircleX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{state.error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm py-2.5 rounded-lg transition"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? 'Creando superadmin...' : 'Crear superadmin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
