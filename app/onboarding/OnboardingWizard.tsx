'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  { number: 1, title: 'Datos de tu clínica' },
  { number: 2, title: 'Tu primer médico' },
  { number: 3, title: 'Disponibilidad' },
  { number: 4, title: 'Tu link está listo' },
]

interface Step1Data {
  name: string
  city: string
  phone: string
  contact_email: string
}

interface Step2Data {
  name: string
  specialty: string
  duration: number
}

interface Props {
  orgId: string
  orgName: string
  userEmail: string
  userId: string
}

export function OnboardingWizard({ orgId, orgName, userEmail, userId }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [finishing, setFinishing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [step1, setStep1] = useState<Step1Data>({
    name: orgName,
    city: '',
    phone: '',
    contact_email: userEmail,
  })
  const [step1Error, setStep1Error] = useState<string | null>(null)

  const [step2, setStep2] = useState<Step2Data>({
    name: '',
    specialty: '',
    duration: 30,
  })
  const [step2Error, setStep2Error] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)

  const totalSteps = STEPS.length
  const progress = (currentStep / totalSteps) * 100

  async function handleNext() {
    if (currentStep === 1) {
      if (!step1.name.trim() || !step1.city.trim()) {
        setStep1Error('Nombre y ciudad son obligatorios.')
        return
      }
      setSaving(true)
      setStep1Error(null)
      const res = await fetch('/api/onboarding/step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...step1 }),
      })
      setSaving(false)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStep1Error(body.error ?? 'Error al guardar.')
        return
      }
    }

    if (currentStep === 2) {
      if (!step2.name.trim() || !step2.specialty.trim()) {
        setStep2Error('Nombre y especialidad son obligatorios.')
        return
      }
      setSaving(true)
      setStep2Error(null)
      const res = await fetch('/api/onboarding/step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, userId, ...step2 }),
      })
      setSaving(false)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStep2Error(body.error ?? 'Error al guardar.')
        return
      }
      const body = await res.json()
      setDoctorId(body.doctorId ?? null)
    }

    setCurrentStep((s) => s + 1)
  }

  async function handleFinish() {
    setFinishing(true)
    await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId }),
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
            {currentStep === 1 && (
              <Step1Form data={step1} setData={setStep1} error={step1Error} />
            )}
            {currentStep === 2 && (
              <Step2Form data={step2} setData={setStep2} error={step2Error} />
            )}
            {currentStep > 2 && (
              <StepPlaceholder step={currentStep} doctorId={doctorId} />
            )}
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
              onClick={handleNext}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando...' : 'Siguiente'}
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

function Step1Form({
  data,
  setData,
  error,
}: {
  data: Step1Data
  setData: React.Dispatch<React.SetStateAction<Step1Data>>
  error: string | null
}) {
  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la clínica <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder="Ej: Clínica Santa María"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ciudad <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.city}
          onChange={(e) => setData((d) => ({ ...d, city: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder="Ej: Bogotá"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono
        </label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder="+57 300 000 0000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email de contacto
        </label>
        <input
          type="email"
          value={data.contact_email}
          onChange={(e) => setData((d) => ({ ...d, contact_email: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder="contacto@clinica.com"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function Step2Form({
  data,
  setData,
  error,
}: {
  data: Step2Data
  setData: React.Dispatch<React.SetStateAction<Step2Data>>
  error: string | null
}) {
  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre completo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder="Ej: Dr. Juan Pérez"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Especialidad <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.specialty}
          onChange={(e) => setData((d) => ({ ...d, specialty: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder="Ej: Medicina general"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Duración de consulta
        </label>
        <select
          value={data.duration}
          onChange={(e) => setData((d) => ({ ...d, duration: Number(e.target.value) }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
        >
          <option value={15}>15 minutos</option>
          <option value={20}>20 minutos</option>
          <option value={30}>30 minutos</option>
          <option value={45}>45 minutos</option>
          <option value={60}>60 minutos</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function StepPlaceholder({ step, doctorId }: { step: number; doctorId: string | null }) {
  const content: Record<number, string> = {
    3: 'Define los días y horarios en que el médico atiende.',
    4: 'Tu link de agendamiento ya está listo para compartir con tus pacientes.',
  }
  const text = content[step]
  if (!text) return null
  return (
    <div className="space-y-2">
      <p className="text-gray-600">{text}</p>
      <p className="text-sm text-gray-400 italic">Contenido del paso {step} — próximamente.</p>
      {step === 3 && doctorId && (
        <p className="text-xs text-gray-400">Doctor ID: {doctorId}</p>
      )}
    </div>
  )
}
