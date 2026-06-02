'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface Props {
  currentPlan: string
  subscriptionStatus: string | null
}

const PLANS = [
  {
    tier: 'free',
    name: 'Free',
    price: 0,
    features: ['1 médico', '50 leads', '20 citas/mes'],
  },
  {
    tier: 'starter',
    name: 'Starter',
    price: 119000,
    features: ['3 médicos', '100 citas/mes', 'Recordatorios automáticos'],
  },
  {
    tier: 'growth',
    name: 'Growth',
    price: 319000,
    features: ['8 médicos', 'Citas ilimitadas', 'CRM completo', 'Conversaciones'],
  },
  {
    tier: 'scale',
    name: 'Scale',
    price: 599000,
    features: ['Médicos ilimitados', 'API access', 'Soporte prioritario'],
  },
]

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n)
}

export function BillingContent({ currentPlan, subscriptionStatus }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const currentPlanDef = PLANS.find(p => p.tier === currentPlan)

  async function handleSubscribe(tier: string) {
    setLoading(tier)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (res.ok && data.init_point) {
        window.location.href = data.init_point
      } else {
        setErrorMsg(data.error ?? 'Error al iniciar la suscripción. Intenta nuevamente.')
      }
    } catch {
      setErrorMsg('Error de conexión. Intenta nuevamente.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Plan y facturación</h2>
        <p className="text-sm text-slate-500 mt-0.5">Gestiona tu suscripción y método de pago.</p>
      </div>

      {/* Current plan banner */}
      <div
        className="rounded-2xl p-4"
        style={{ background: '#EBF0F6', border: '1px solid #C8D8E4' }}
      >
        <p className="text-sm text-slate-700">
          Tu plan actual:{' '}
          <strong style={{ color: '#215F73' }}>
            {currentPlanDef?.name ?? currentPlan}
          </strong>
        </p>
        {subscriptionStatus === 'pending' && (
          <p className="mt-1 text-sm" style={{ color: '#4A6B7A' }}>
            Tienes un pago pendiente de confirmación.
          </p>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</p>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const isCurrent = plan.tier === currentPlan
          const isPaid    = plan.tier !== 'free'

          return (
            <div
              key={plan.tier}
              className="rounded-2xl bg-white p-5 flex flex-col"
              style={{
                border: isCurrent
                  ? '2px solid #215F73'
                  : '1px solid #C8D8E4',
              }}
            >
              {/* Badge */}
              {isCurrent && (
                <span
                  className="self-start mb-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ background: '#215F73' }}
                >
                  Plan actual
                </span>
              )}

              {/* Name & price */}
              <p className="font-bold text-slate-900 text-base">{plan.name}</p>
              <p className="mt-1 text-lg font-bold" style={{ color: '#215F73' }}>
                {plan.price === 0 ? 'Gratis' : `${formatCOP(plan.price)}/mes`}
              </p>

              {/* Features */}
              <ul className="mt-4 space-y-2 flex-1">
                {plan.features.map(feat => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#215F73' }} />
                    {feat}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {!isCurrent && isPaid && (
                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={loading === plan.tier}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ background: '#215F73' }}
                  onMouseEnter={e => {
                    if (loading !== plan.tier) (e.currentTarget as HTMLElement).style.background = '#0D2B3E'
                  }}
                  onMouseLeave={e => {
                    if (loading !== plan.tier) (e.currentTarget as HTMLElement).style.background = '#215F73'
                  }}
                >
                  {loading === plan.tier
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : `Cambiar a ${plan.name}`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
