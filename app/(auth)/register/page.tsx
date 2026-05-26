'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { TermsModal } from '@/components/legal/terms-modal'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'US$0',
    features: ['1 médico', '50 leads', '20 citas/mes'],
    badge: null,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 'US$29',
    features: ['3 médicos', '100 citas/mes', 'Recordatorios automáticos'],
    badge: null,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 'US$79',
    features: ['8 médicos', 'Citas ilimitadas', 'CRM completo', 'Conversaciones'],
    badge: 'Recomendado',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 'US$149',
    features: ['Médicos ilimitados', 'API access', 'Soporte prioritario'],
    badge: null,
  },
] as const

type PlanId = (typeof PLANS)[number]['id']

const registerSchema = z.object({
  clinic_name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type RegisterForm = z.infer<typeof registerSchema>

const BENEFITS = [
  'Agenda online 24/7 — tus pacientes agendan solos',
  'Cero citas perdidas — confirmaciones y recordatorios automáticos',
  'CRM médico — toda la info de tus pacientes en un solo lugar',
]

const inputCls = 'w-full h-11 px-3 border border-[#C8D8E4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#215F73] focus:border-transparent transition bg-white'
const labelCls = 'block text-sm font-medium text-[#0D2B3E] mb-1'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  function selectPlan(plan: PlanId) {
    setSelectedPlan(plan)
    setStep(2)
  }

  async function handleGoogleSignup() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://app.medscale.app/auth/callback' },
    })
  }

  async function onSubmit(data: RegisterForm) {
    setServerError(null)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { clinic_name: data.clinic_name } },
    })

    if (authError) { setServerError(authError.message); return }

    const userId = authData.user?.id
    if (!userId) { setServerError('No se pudo crear la cuenta. Intenta de nuevo.'); return }

    const res = await fetch('/api/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan, clinic_name: data.clinic_name, user_id: userId }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setServerError(body.error ?? 'Error al configurar la organización.')
      return
    }

    const body = await res.json().catch(() => ({}))
    router.push(body.redirect ?? '/dashboard')
    router.refresh()
  }

  const planData = PLANS.find(p => p.id === selectedPlan)

  return (
    <div className="min-h-screen bg-[#EBF0F6]">

      {/* ── STEP 1: Plan selection ── */}
      {step === 1 && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
          {/* Logo */}
          <div className="mb-10 text-center">
            <p className="text-xl font-bold tracking-tight text-[#0D2B3E]">MEDSCALE AI</p>
            <p className="text-xs tracking-widest text-[#4A6B7A] mt-0.5">FOR HEALTHCARE GROWTH</p>
          </div>

          {/* Headline */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-[#0D2B3E] leading-tight">
              El sistema de crecimiento<br />
              para tu <span className="text-[#5A9DB5]">consultorio</span>
            </h1>
            <p className="text-[#4A6B7A] mt-3">Elige el plan que necesitas. Cambia cuando quieras.</p>
          </div>

          {/* Plan cards */}
          <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className={`relative flex flex-col bg-white rounded-2xl p-6 transition cursor-pointer hover:shadow-lg ${
                  plan.badge
                    ? 'border-2 border-[#215F73] shadow-md'
                    : 'border border-[#C8D8E4] hover:border-[#215F73]'
                }`}
                onClick={() => selectPlan(plan.id)}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#215F73] text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                )}

                <p className="text-sm font-semibold text-[#0D2B3E]">{plan.name}</p>
                <div className="mt-1 mb-4">
                  <span className="text-3xl font-bold text-[#0D2B3E]">{plan.price}</span>
                  <span className="text-sm text-[#4A6B7A]">/mes</span>
                </div>

                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#4A6B7A]">
                      <span className="text-[#215F73] mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  className="w-full bg-[#215F73] hover:bg-[#1a4d5e] text-white text-sm font-semibold py-2.5 rounded-xl transition"
                >
                  Seleccionar
                </button>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-[#4A6B7A]">
            ¿Ya tienes cuenta?{' '}
            <a href="/login" className="text-[#215F73] font-semibold hover:underline">Inicia sesión</a>
          </p>
        </div>
      )}

      {/* ── STEP 2: Create account ── */}
      {step === 2 && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

            {/* Left column — pitch */}
            <div className="flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-[#0D2B3E] leading-snug">
                Comienza con el plan{' '}
                <span className="text-[#5A9DB5] capitalize">{planData?.name}</span>
              </h2>
              <p className="text-3xl font-bold text-[#215F73] mt-1 mb-6">
                {planData?.price}<span className="text-base font-normal text-[#4A6B7A]">/mes</span>
              </p>

              <ul className="space-y-4 mb-8">
                {BENEFITS.map(b => (
                  <li key={b} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#215F73] shrink-0 mt-0.5" />
                    <span className="text-[#0D2B3E] text-sm leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>

              <p className="text-sm text-[#4A6B7A] italic mb-6">
                Únete a consultorios que ya crecen con MedScale AI
              </p>

              <button
                onClick={() => setStep(1)}
                className="text-sm text-[#4A6B7A] hover:text-[#215F73] transition self-start"
              >
                ← Cambiar plan
              </button>
            </div>

            {/* Right column — form */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-[#0D2B3E]">Crea tu cuenta</h3>
              <p className="text-sm text-[#4A6B7A] mt-1 mb-6">
                Configura tu consultorio en menos de 2 minutos
              </p>

              {/* Google OAuth */}
              <button
                type="button"
                onClick={handleGoogleSignup}
                className="w-full flex items-center justify-center gap-3 border border-[#C8D8E4] rounded-xl h-11 text-sm font-medium text-[#0D2B3E] hover:bg-[#EBF0F6] transition mb-4"
              >
                <svg viewBox="0 0 48 48" className="w-5 h-5">
                  <path fill="#4285F4" d="M44 24c0-1.3-.1-2.5-.3-3.7H24v7h11.3c-.5 2.6-2 4.8-4.2 6.3v5.2h6.8C41.5 35.4 44 30.1 44 24z"/>
                  <path fill="#34A853" d="M24 44c5.6 0 10.3-1.9 13.7-5.1l-6.8-5.2c-1.9 1.3-4.3 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.6v5.4C9 39.4 16 44 24 44z"/>
                  <path fill="#FBBC05" d="M12.6 27.3c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.4H5.6C4.1 17 3 20.4 3 24s1.1 7 3.6 10.1l7-5.8z"/>
                  <path fill="#EA4335" d="M24 10.6c3 0 5.7 1 7.8 3l5.8-5.8C34.3 4.5 29.6 2 24 2 16 2 9 6.6 5.6 13.9l7 5.4C14.2 14.2 18.7 10.6 24 10.6z"/>
                </svg>
                Continuar con Google
              </button>

              {/* Divider */}
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#C8D8E4]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-[#4A6B7A]">o continúa con email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="clinic_name" className={labelCls}>Nombre del consultorio</label>
                  <input
                    id="clinic_name"
                    type="text"
                    placeholder="Ej: Consultorio Dr. García"
                    className={inputCls}
                    {...register('clinic_name')}
                  />
                  {errors.clinic_name && <p className="mt-1 text-xs text-red-500">{errors.clinic_name.message}</p>}
                </div>

                <div>
                  <label htmlFor="email" className={labelCls}>Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@email.com"
                    className={inputCls}
                    {...register('email')}
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                </div>

                <div>
                  <label htmlFor="password" className={labelCls}>Contraseña</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={inputCls}
                    {...register('password')}
                  />
                  {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
                </div>

                {serverError && (
                  <p className="text-sm text-red-500">{serverError}</p>
                )}

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 shrink-0 rounded border-[#C8D8E4] accent-[#215F73]"
                  />
                  <span className="text-sm text-[#4A6B7A]">
                    Acepto los{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-[#215F73] font-medium hover:underline"
                    >
                      términos y condiciones
                    </button>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || !acceptedTerms}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-[#215F73] hover:bg-[#1a4d5e] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-[#4A6B7A]">
                ¿Ya tienes cuenta?{' '}
                <a href="/login" className="text-[#215F73] font-semibold hover:underline">Inicia sesión</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  )
}
