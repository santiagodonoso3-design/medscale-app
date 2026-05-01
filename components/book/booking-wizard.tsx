'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, UserPlus, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react'

interface DoctorMetadata {
  name?: string | null
  default_duration?: number | null
  [key: string]: unknown
}

interface DoctorOption {
  id: string
  specialty: string | null
  is_active: boolean
  metadata: DoctorMetadata | null
}

interface LocationOption {
  id: string
  name: string
}

interface ScheduleOption {
  id: string
  doctor_id: string
  location_id: string
  room_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
}

interface FormField {
  field_name: string
  field_type: 'text' | 'email' | 'tel' | 'number'
  required: boolean
  order: number
}

interface BookingWizardProps {
  orgName: string
  orgSlug: string
  orgId: string
  doctors: DoctorOption[]
  locations: LocationOption[]
  schedules: ScheduleOption[]
  formFields: FormField[]
}

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function BookingWizard({ orgName, orgSlug, orgId, doctors, locations, schedules, formFields }: BookingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    modality: 'presencial' as 'presencial' | 'virtual',
    doctor_id: '',
    date: '',
    time: '',
    patient_name: '',
    phone: '',
    email: '',
    cedula: '',
    customFields: {} as Record<string, string>,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const availableDoctors = doctors.filter((doctor) => doctor.is_active)

  const selectedDoctor = useMemo(
    () => availableDoctors.find((doctor) => doctor.id === formData.doctor_id) || null,
    [availableDoctors, formData.doctor_id]
  )

  const availableSchedules = useMemo(() => {
    if (!selectedDoctor) return []
    return schedules.filter((schedule) => schedule.doctor_id === selectedDoctor.id)
  }, [schedules, selectedDoctor])

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1)
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = {
        org_slug: orgSlug,
        modality: formData.modality,
        doctor_id: formData.doctor_id || null, // null for round-robin
        date: formData.date,
        time: formData.time,
        patient_name: formData.patient_name,
        phone: formData.phone,
        email: formData.email,
        cedula: formData.cedula,
        custom_fields: formData.customFields,
      }

      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error creando la cita')
      }

      setSuccess(true)
      setCurrentStep(5)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {step}
          </div>
          {step < 4 && <div className={`w-12 h-0.5 ${step < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Tipo de consulta</h2>
        <p className="text-gray-600 mt-2">Selecciona cómo prefieres realizar tu consulta</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setFormData({ ...formData, modality: 'presencial' })}
          className={`p-6 rounded-2xl border-2 transition ${
            formData.modality === 'presencial' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Presencial</h3>
            <p className="text-sm text-gray-600 mt-1">En la clínica</p>
          </div>
        </button>
        <button
          onClick={() => setFormData({ ...formData, modality: 'virtual' })}
          className={`p-6 rounded-2xl border-2 transition ${
            formData.modality === 'virtual' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock3 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Virtual</h3>
            <p className="text-sm text-gray-600 mt-1">Por videollamada</p>
          </div>
        </button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Selecciona médico</h2>
        <p className="text-gray-600 mt-2">Elige un médico específico o sin preferencia</p>
      </div>
      <div className="space-y-3">
        <button
          onClick={() => setFormData({ ...formData, doctor_id: '' })}
          className={`w-full p-4 rounded-2xl border-2 text-left transition ${
            formData.doctor_id === '' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="font-semibold text-gray-900">Sin preferencia</div>
          <div className="text-sm text-gray-600">Asignación automática al médico disponible</div>
        </button>
        {availableDoctors.map((doctor) => (
          <button
            key={doctor.id}
            onClick={() => setFormData({ ...formData, doctor_id: doctor.id })}
            className={`w-full p-4 rounded-2xl border-2 text-left transition ${
              formData.doctor_id === doctor.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">{String(doctor.metadata?.name ?? 'Médico')}</div>
            <div className="text-sm text-gray-600">{doctor.specialty || 'General'}</div>
          </button>
        ))}
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Fecha y hora</h2>
        <p className="text-gray-600 mt-2">Selecciona la fecha y hora disponible</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Hora</label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
      {selectedDoctor && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Horarios disponibles para {String(selectedDoctor.metadata?.name ?? 'Médico')}</h3>
          <div className="space-y-2">
            {availableSchedules.map((schedule) => (
              <div key={schedule.id} className="text-sm text-gray-600">
                {weekdays[schedule.day_of_week]}: {schedule.start_time} - {schedule.end_time}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Tus datos</h2>
        <p className="text-gray-600 mt-2">Completa tu información para confirmar la cita</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nombre completo *</label>
          <input
            type="text"
            value={formData.patient_name}
            onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono *</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Cédula *</label>
          <input
            type="text"
            value={formData.cedula}
            onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        {formFields.map((field) => (
          <div key={field.field_name} className={field.field_type === 'text' ? 'col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.field_name} {field.required ? '*' : ''}
            </label>
            <input
              type={field.field_type}
              value={formData.customFields[field.field_name] || ''}
              onChange={(e) => setFormData({
                ...formData,
                customFields: { ...formData.customFields, [field.field_name]: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required={field.required}
            />
          </div>
        ))}
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="text-center space-y-6">
      {success ? (
        <>
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">¡Cita agendada!</h2>
          <p className="text-gray-600">Recibirás una confirmación por email y SMS.</p>
          <div className="bg-gray-50 p-6 rounded-lg text-left">
            <h3 className="font-semibold text-gray-900 mb-4">Resumen de tu cita</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Médico:</strong> {selectedDoctor ? String(selectedDoctor.metadata?.name ?? 'Asignado automáticamente') : 'Sin preferencia'}</div>
              <div><strong>Fecha:</strong> {formData.date}</div>
              <div><strong>Hora:</strong> {formData.time}</div>
              <div><strong>Modalidad:</strong> {formData.modality === 'presencial' ? 'Presencial' : 'Virtual'}</div>
              <div><strong>Paciente:</strong> {formData.patient_name}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-900">Confirmar cita</h2>
          <div className="bg-gray-50 p-6 rounded-lg text-left">
            <h3 className="font-semibold text-gray-900 mb-4">Resumen</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Médico:</strong> {selectedDoctor ? String(selectedDoctor.metadata?.name ?? 'Médico') : 'Sin preferencia'}</div>
              <div><strong>Fecha:</strong> {formData.date}</div>
              <div><strong>Hora:</strong> {formData.time}</div>
              <div><strong>Modalidad:</strong> {formData.modality === 'presencial' ? 'Presencial' : 'Virtual'}</div>
              <div><strong>Paciente:</strong> {formData.patient_name}</div>
            </div>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-500">Reservar cita</p>
            <h1 className="text-3xl font-bold text-gray-900">{orgName}</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            <CalendarDays className="h-4 w-4 text-violet-600" />
            Reservas públicas
          </div>
        </div>

        {renderStepIndicator()}

        <div className="min-h-[400px]">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </div>

        <div className="flex justify-between mt-8">
          {currentStep > 1 && currentStep < 5 && (
            <button
              onClick={handlePrev}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </button>
          )}
          {currentStep < 4 && (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-auto"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {currentStep === 4 && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-auto disabled:opacity-50"
            >
              {loading ? 'Agendando...' : 'Confirmar cita'}
              <UserPlus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}