'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const inputCls = 'w-full h-11 px-3 border border-[#C8D8E4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#215F73] focus:border-transparent transition bg-white'
const labelCls = 'block text-sm font-medium text-[#0D2B3E] mb-1'

export function CompleteProfileForm({
  defaultClinicName,
  defaultReferralCode,
}: {
  defaultClinicName: string
  defaultReferralCode: string
}) {
  const router = useRouter()
  const [clinicName, setClinicName]   = useState(defaultClinicName)
  const [referralCode, setReferralCode] = useState(defaultReferralCode)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const prefilled = defaultClinicName.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicName.trim()) { setError('Ingresa el nombre de tu consultorio'); return }
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic_name: clinicName.trim(),
        referral_code: referralCode.trim() || undefined,
      }),
    })

    // Already has an org (double submit / race) → not an error, go to the app.
    if (res.status === 409) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'No se pudo crear el consultorio. Intenta de nuevo.')
      setSubmitting(false)
      return
    }

    const body = await res.json().catch(() => ({}))
    router.push(body.redirect ?? '/onboarding')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#EBF0F6] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo-dark.png" alt="MedScale AI" className="h-9 mx-auto" />
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-xl font-bold text-[#0D2B3E]">
            {prefilled ? 'Confirma tu consultorio' : 'Crea tu consultorio'}
          </h1>
          <p className="text-sm text-[#4A6B7A] mt-1 mb-6">
            {prefilled
              ? 'Todo listo para dejar tu cuenta activa. Solo confirma el nombre.'
              : 'Un último paso para empezar a usar MedScale AI.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="clinic_name" className={labelCls}>Nombre del consultorio</label>
              <input
                id="clinic_name"
                type="text"
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                placeholder="Ej: Consultorio Dr. García"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="referral_code" className={labelCls}>
                Código de referido{' '}
                <span className="text-[#4A6B7A] font-normal normal-case tracking-normal">(opcional)</span>
              </label>
              <input
                id="referral_code"
                type="text"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Ej: DRGARCIA20"
                className={`${inputCls} font-mono`}
                autoComplete="off"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 flex items-center justify-center gap-2 bg-[#215F73] hover:bg-[#1a4d5e] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creando...' : 'Crear mi consultorio'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
