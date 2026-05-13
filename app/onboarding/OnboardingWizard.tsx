'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  { number: 1, title: 'Datos de tu clínica' },
  { number: 2, title: 'Tu primer médico' },
  { number: 3, title: 'Disponibilidad' },
  { number: 4, title: 'Tu link está listo' },
]

interface Props {
  organizationId: string
  organizationName: string
}

export function OnboardingWizard({ organizationId, organizationName }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [finishing, setFinishing] = useState(false)

  const totalSteps = STEPS.length
  const progress = (currentStep / totalSteps) * 100

  async function handleFinish() {
    setFinishing(true)
    await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId }),
    })
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-sm text-gray-500 mb-1">Paso {currentStep} de {totalSteps}</p>
          <h1 className="text-2xl font-semibold text-gray-900">
            {STEPS[currentStep - 1].title}
          </h1>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-200 rounded-full mb-8">
          <div
            className="h-1.5 bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step.number < currentStep
                    ? 'bg-blue-600 text-white'
                    : step.number === currentStep
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.number < currentStep ? '✓' : step.number}
              </div>
              <span className={`text-xs hidden sm:block ${step.number === currentStep ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-8">
            <StepContent step={currentStep} organizationName={organizationName} />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={() => setCurrentStep((s) => s + 1)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {finishing ? 'Guardando...' : 'Ir al dashboard'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepContent({ step, organizationName }: { step: number; organizationName: string }) {
  switch (step) {
    case 1:
      return (
        <div className="space-y-2">
          <p className="text-gray-600">Aquí configurarás el nombre, dirección, teléfono y logo de <strong>{organizationName}</strong>.</p>
          <p className="text-sm text-gray-400 italic">Contenido del paso 1 — próximamente.</p>
        </div>
      )
    case 2:
      return (
        <div className="space-y-2">
          <p className="text-gray-600">Agrega el primer médico de tu clínica: nombre, especialidad y duración de cita.</p>
          <p className="text-sm text-gray-400 italic">Contenido del paso 2 — próximamente.</p>
        </div>
      )
    case 3:
      return (
        <div className="space-y-2">
          <p className="text-gray-600">Define los días y horarios en que el médico atiende.</p>
          <p className="text-sm text-gray-400 italic">Contenido del paso 3 — próximamente.</p>
        </div>
      )
    case 4:
      return (
        <div className="space-y-2">
          <p className="text-gray-600">Tu link de agendamiento ya está listo para compartir con tus pacientes.</p>
          <p className="text-sm text-gray-400 italic">Contenido del paso 4 — próximamente.</p>
        </div>
      )
    default:
      return null
  }
}
