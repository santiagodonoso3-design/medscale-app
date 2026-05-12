'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check } from 'lucide-react'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mes',
    features: ['1 médico', '50 leads', '20 citas/mes'],
    badge: null,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    period: '/mes',
    features: ['3 médicos', '100 citas/mes'],
    badge: null,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$79',
    period: '/mes',
    features: ['8 médicos', 'Citas ilimitadas'],
    badge: 'Recomendado',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '$149',
    period: '/mes',
    features: ['Médicos ilimitados', 'API access'],
    badge: null,
  },
] as const

type PlanId = (typeof PLANS)[number]['id']

const registerSchema = z.object({
  clinic_name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  phone: z.string().optional(),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  function selectPlan(plan: PlanId) {
    setSelectedPlan(plan)
    setStep(2)
  }

  async function handleGoogleSignup() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://app.medscale.app/auth/callback',
      },
    })
  }

  async function onSubmit(data: RegisterForm) {
    setServerError(null)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          clinic_name: data.clinic_name,
          phone: data.phone ?? '',
        },
      },
    })

    if (authError) {
      setServerError(authError.message)
      return
    }

    const userId = authData.user?.id
    if (!userId) {
      setServerError('No se pudo crear la cuenta. Intenta de nuevo.')
      return
    }

    const res = await fetch('/api/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: selectedPlan,
        clinic_name: data.clinic_name,
        phone: data.phone ?? '',
        user_id: userId,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setServerError(body.error ?? 'Error al configurar la organización.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-3xl">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2].map(n => (
            <div key={n} className="flex items-center gap-3">
              <div className={[
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition',
                step > n
                  ? 'bg-blue-600 text-white'
                  : step === n
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-gray-200 text-gray-500',
              ].join(' ')}>
                {step > n ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span className={[
                'text-sm font-medium',
                step >= n ? 'text-gray-900' : 'text-gray-400',
              ].join(' ')}>
                {n === 1 ? 'Elige tu plan' : 'Crea tu cuenta'}
              </span>
              {n < 2 && <div className="w-8 h-px bg-gray-300 mx-1" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Plan selection ── */}
        {step === 1 && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Medscale AI</h1>
              <p className="text-sm text-gray-500 mt-1">Elige el plan que mejor se adapta a tu clínica</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {PLANS.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => selectPlan(plan.id)}
                  className={[
                    'relative flex flex-col items-start rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md',
                    selectedPlan === plan.id
                      ? 'ring-2 ring-blue-600 border-blue-600'
                      : 'border-gray-200 hover:border-blue-300',
                  ].join(' ')}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white whitespace-nowrap">
                      {plan.badge}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                  <div className="mt-1 mb-3">
                    <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-xs text-gray-500">{plan.period}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <Check className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Create account ── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
            <div className="mb-6">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-gray-400 hover:text-gray-600 transition mb-4"
              >
                ← Volver a planes
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Medscale AI</h1>
              <p className="text-sm text-gray-500 mt-1">Crea tu cuenta — plan <span className="font-medium capitalize text-blue-600">{selectedPlan}</span></p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="clinic_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la clínica
                </label>
                <input
                  id="clinic_name"
                  type="text"
                  placeholder="Ej: Clínica Santa María"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  {...register('clinic_name')}
                />
                {errors.clinic_name && (
                  <p className="mt-1 text-xs text-red-600">{errors.clinic_name.message}</p>
                )}
              </div>

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
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+57 300 000 0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  {...register('phone')}
                />
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
                {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              ¿Ya tienes cuenta?{' '}
              <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Inicia sesión</a>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
