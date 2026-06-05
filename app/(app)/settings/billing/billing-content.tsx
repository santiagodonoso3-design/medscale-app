'use client'

import { Check } from 'lucide-react'

interface Props {
  currentPlan: string
  subscriptionStatus: string | null
}

const PLANS = [
  {
    tier: 'consultorio',
    name: 'Consultorio',
    price: 'US$89',
    features: ['1 médico', '1 sede', 'Agenda online', 'CRM básico'],
    badge: null,
  },
  {
    tier: 'clinica',
    name: 'Clínica',
    price: 'US$249',
    features: ['Hasta 6 médicos', '1 sede', 'CRM completo', 'Conversaciones', 'Export Excel'],
    badge: 'Recomendado',
  },
  {
    tier: 'red',
    name: 'Red',
    price: 'A medida',
    features: ['Médicos ilimitados', 'Sedes ilimitadas', 'API access', 'Soporte prioritario'],
    badge: null,
  },
]

export function BillingContent({ currentPlan, subscriptionStatus }: Props) {
  const currentPlanDef = PLANS.find(p => p.tier === currentPlan)

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

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isCurrent = plan.tier === currentPlan

          return (
            <div
              key={plan.tier}
              className="relative rounded-2xl bg-white p-5 flex flex-col"
              style={{
                border: isCurrent
                  ? '2px solid #215F73'
                  : '1px solid #C8D8E4',
              }}
            >
              {/* Badge */}
              {plan.badge && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap"
                  style={{ background: '#215F73' }}
                >
                  {plan.badge}
                </span>
              )}
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
              <p className="mt-1 text-base font-bold" style={{ color: '#215F73' }}>
                {plan.price}
                {plan.tier !== 'red' && (
                  <span className="text-xs font-normal ml-0.5" style={{ color: '#4A6B7A' }}>/mes</span>
                )}
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
              {!isCurrent && (
                <a
                  href="mailto:soporte@medscale.app?subject=Quiero cambiar mi plan"
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition"
                  style={{ background: '#215F73' }}
                >
                  Contactar al equipo
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Los cambios de plan son gestionados por el equipo de MedScale.
        Escríbenos a{' '}
        <a href="mailto:soporte@medscale.app" className="underline">soporte@medscale.app</a>
      </p>
    </div>
  )
}
