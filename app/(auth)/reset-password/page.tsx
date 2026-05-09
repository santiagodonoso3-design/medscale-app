'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    // Handle invitation flow: #access_token=...
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.slice(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const tokenType = params.get('type')

      if (accessToken && (tokenType === 'invite' || tokenType === 'recovery')) {
        const supabase = createClient()
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        }).then(({ error }) => {
          if (error) setError('El enlace es inválido o ha expirado.')
        })
      }
    } else if (token_hash && type === 'recovery') {
      const supabase = createClient()
      supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
        .then(({ error }) => {
          if (error) setError('El enlace es inválido o ha expirado.')
        })
    }
  }, [searchParams])

  async function handleReset() {
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const isInviteFlow = typeof window !== 'undefined' &&
      window.location.hash.includes('access_token')

    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    if (!isInviteFlow && token_hash && type === 'recovery') {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'recovery'
      })
      if (verifyError) {
        setError('El enlace es inválido o ha expirado.')
        setLoading(false)
        return
      }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Error al actualizar la contraseña.')
    } else {
      setDone(true)
      const supabase2 = createClient()
      await supabase2.auth.signOut()
      setTimeout(() => router.push('/login'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        {!done ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold text-gray-900">Nueva contraseña</h1>
              <p className="text-sm text-gray-500 mt-1">Ingresa tu nueva contraseña</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              <button
                onClick={handleReset}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg transition"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Actualizar contraseña
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">¡Contraseña actualizada!</h2>
            <p className="text-sm text-gray-500">Redirigiendo al dashboard...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
