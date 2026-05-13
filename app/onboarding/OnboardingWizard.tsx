'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  { number: 1, title: 'Datos de tu clínica' },
  { number: 2, title: 'Tu primer médico' },
  { number: 3, title: 'Disponibilidad' },
  { number: 4, title: 'Tu link está listo' },
]

const DAY_NAMES: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
  4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo',
}
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function timeOptions(from: number, to: number) {
  const opts: string[] = []
  for (let h = from; h <= to; h++) {
    opts.push(`${String(h).padStart(2, '0')}:00`)
    if (h < to) opts.push(`${String(h).padStart(2, '0')}:30`)
  }
  return opts
}
const START_TIMES = timeOptions(6, 20)   // 06:00 – 20:30
const END_TIMES   = timeOptions(6, 22)   // 06:00 – 22:00

interface DaySchedule {
  active: boolean
  start: string
  end: string
}

type Step3Data = Record<number, DaySchedule>

function defaultStep3(): Step3Data {
  const data: Step3Data = {}
  DAY_ORDER.forEach((d) => {
    data[d] = {
      active: d >= 1 && d <= 5,
      start: '08:00',
      end: '17:00',
    }
  })
  return data
}

interface Step1Data { name: string; city: string; phone: string; contact_email: string }
interface Step2Data { name: string; specialty: string; duration: number }

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

  const [step1, setStep1] = useState<Step1Data>({ name: orgName, city: '', phone: '', contact_email: userEmail })
  const [step1Error, setStep1Error] = useState<string | null>(null)

  const [step2, setStep2] = useState<Step2Data>({ name: '', specialty: '', duration: 30 })
  const [step2Error, setStep2Error] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)

  const [step3, setStep3] = useState<Step3Data>(defaultStep3)
  const [step3Error, setStep3Error] = useState<string | null>(null)

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

    if (currentStep === 3) {
      if (!doctorId) {
        setStep3Error('No se encontró el médico. Vuelve al paso anterior.')
        return
      }
      const schedules = DAY_ORDER.filter((d) => step3[d].active).map((d) => ({
        day_of_week: d,
        start_time: step3[d].start,
        end_time: step3[d].end,
      }))
      if (schedules.length === 0) {
        setStep3Error('Activa al menos un día de disponibilidad.')
        return
      }
      setSaving(true)
      setStep3Error(null)
      const res = await fetch('/api/onboarding/step3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, schedules }),
      })
      setSaving(false)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStep3Error(body.error ?? 'Error al guardar.')
        return
      }
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
          <h1 className="text-2xl font-semibold text-gray-900">{STEPS[currentStep - 1].title}</h1>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-200 rounded-full mb-8">
          <div className="h-1.5 bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step.number < currentStep ? 'bg-blue-600 text-white'
                : step.number === currentStep ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : 'bg-gray-200 text-gray-500'
              }`}>
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
            {currentStep === 1 && <Step1Form data={step1} setData={setStep1} error={step1Error} />}
            {currentStep === 2 && <Step2Form data={step2} setData={setStep2} error={step2Error} />}
            {currentStep === 3 && <Step3Form data={step3} setData={setStep3} error={step3Error} />}
            {currentStep === 4 && <StepFinal />}
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

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1Form({ data, setData, error }: {
  data: Step1Data
  setData: React.Dispatch<React.SetStateAction<Step1Data>>
  error: string | null
}) {
  return (
    <div className="space-y-5 max-w-xl">
      <Field label="Nombre de la clínica" required>
        <input type="text" value={data.name}
          onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
          className={inputCls} placeholder="Ej: Clínica Santa María" />
      </Field>
      <Field label="Ciudad" required>
        <input type="text" value={data.city}
          onChange={(e) => setData((d) => ({ ...d, city: e.target.value }))}
          className={inputCls} placeholder="Ej: Bogotá" />
      </Field>
      <Field label="Teléfono">
        <input type="tel" value={data.phone}
          onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))}
          className={inputCls} placeholder="+57 300 000 0000" />
      </Field>
      <Field label="Email de contacto">
        <input type="email" value={data.contact_email}
          onChange={(e) => setData((d) => ({ ...d, contact_email: e.target.value }))}
          className={inputCls} placeholder="contacto@clinica.com" />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2Form({ data, setData, error }: {
  data: Step2Data
  setData: React.Dispatch<React.SetStateAction<Step2Data>>
  error: string | null
}) {
  return (
    <div className="space-y-5 max-w-xl">
      <Field label="Nombre completo" required>
        <input type="text" value={data.name}
          onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
          className={inputCls} placeholder="Ej: Dr. Juan Pérez" />
      </Field>
      <Field label="Especialidad" required>
        <input type="text" value={data.specialty}
          onChange={(e) => setData((d) => ({ ...d, specialty: e.target.value }))}
          className={inputCls} placeholder="Ej: Medicina general" />
      </Field>
      <Field label="Duración de consulta">
        <select value={data.duration}
          onChange={(e) => setData((d) => ({ ...d, duration: Number(e.target.value) }))}
          className={inputCls + ' bg-white'}>
          {[15, 20, 30, 45, 60].map((m) => (
            <option key={m} value={m}>{m} minutos</option>
          ))}
        </select>
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ── Step 3 ────────────────────────────────────────────────────────────────────

function Step3Form({ data, setData, error }: {
  data: Step3Data
  setData: React.Dispatch<React.SetStateAction<Step3Data>>
  error: string | null
}) {
  function toggle(day: number) {
    setData((d) => ({ ...d, [day]: { ...d[day], active: !d[day].active } }))
  }
  function setTime(day: number, field: 'start' | 'end', value: string) {
    setData((d) => ({ ...d, [day]: { ...d[day], [field]: value } }))
  }

  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-500 mb-4">Configura el horario de atención para cada día.</p>
      {DAY_ORDER.map((day) => {
        const s = data[day]
        return (
          <div key={day} className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${s.active ? 'bg-gray-50' : 'opacity-50'}`}>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => toggle(day)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${s.active ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${s.active ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>

            {/* Day name */}
            <span className="w-24 text-sm font-medium text-gray-700">{DAY_NAMES[day]}</span>

            {/* Time selects */}
            <div className="flex items-center gap-2 flex-1">
              <select
                value={s.start}
                onChange={(e) => setTime(day, 'start', e.target.value)}
                disabled={!s.active}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
              >
                {START_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-gray-400 text-sm">–</span>
              <select
                value={s.end}
                onChange={(e) => setTime(day, 'end', e.target.value)}
                disabled={!s.active}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
              >
                {END_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )
      })}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

function StepFinal() {
  return (
    <div className="space-y-2">
      <p className="text-gray-600">Tu link de agendamiento ya está listo para compartir con tus pacientes.</p>
      <p className="text-sm text-gray-400 italic">Contenido del paso 4 — próximamente.</p>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
