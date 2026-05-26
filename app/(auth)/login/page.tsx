'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { TermsModal } from '@/components/legal/terms-modal'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showForgot, setShowForgot] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setServerError('Credenciales incorrectas. Intenta de nuevo.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://app.medscale.app/auth/callback',
      },
    })
  }

  async function handleForgotPassword() {
    if (!forgotEmail) return
    setForgotLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: 'https://app.medscale.app/reset-password',
    })
    setForgotSent(true)
    setForgotLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Medscale AI</h1>
            <p className="text-sm text-gray-500 mt-1">Inicia sesión en tu cuenta</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition mb-4"
          >
            <svg viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#4285F4" d="M44 24c0-1.3-.1-2.5-.3-3.7H24v7h11.3c-.5 2.6-2 4.8-4.2 6.3v5.2h6.8C41.5 35.4 44 30.1 44 24z"/>
              <path fill="#34A853" d="M24 44c5.6 0 10.3-1.9 13.7-5.1l-6.8-5.2c-1.9 1.3-4.3 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.6v5.4C9 39.4 16 44 24 44z"/>
              <path fill="#FBBC05" d="M12.6 27.3c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.4H5.6C4.1 17 3 20.4 3 24s1.1 7 3.6 10.1l7-5.8z"/>
              <path fill="#EA4335" d="M24 10.6c3 0 5.7 1 7.8 3l5.8-5.8C34.3 4.5 29.6 2 24 2 16 2 9 6.6 5.6 13.9l7 5.4C14.2 14.2 18.7 10.6 24 10.6z"/>
            </svg>
            Continuar con Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400">o continúa con email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-xs text-blue-600 hover:text-blue-700 transition"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {serverError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm py-2.5 rounded-lg transition"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>

            <p className="text-center text-xs text-slate-400">
              Al iniciar sesión aceptas los{' '}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="underline hover:text-slate-600 transition"
              >
                términos y condiciones
              </button>
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <a href="/register" className="text-blue-600 hover:text-blue-700 font-medium">Regístrate gratis</a>
          </p>

          {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

          {showForgot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-sm">
                {!forgotSent ? (
                  <>
                    <h2 className="text-base font-bold text-gray-900 mb-1">Recuperar contraseña</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
                    </p>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleForgotPassword}
                        disabled={forgotLoading || !forgotEmail}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition"
                      >
                        {forgotLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Enviar enlace
                      </button>
                      <button
                        onClick={() => setShowForgot(false)}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center py-2">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h2 className="text-base font-bold text-gray-900 mb-1">Email enviado</h2>
                      <p className="text-sm text-gray-500 mb-4">
                        Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.
                      </p>
                      <button
                        onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
                        className="text-sm text-blue-600 hover:text-blue-700 transition"
                      >
                        Volver al login
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
