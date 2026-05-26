'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type Plan = 'free' | 'starter' | 'growth' | 'scale'

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: 'free',    label: 'Free — US$0/mes (1 médico, 50 leads, 20 citas/mes)' },
  { value: 'starter', label: 'Starter — US$29/mes (3 médicos, 100 citas/mes)' },
  { value: 'growth',  label: 'Growth — US$79/mes (8 médicos, ilimitado)' },
  { value: 'scale',   label: 'Scale — US$149/mes (ilimitado + API)' },
]

interface OrganizationFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onSave: (payload: {
    id?: string
    name: string
    slug: string
    plan: Plan
    is_active: boolean
    ai_agent_enabled: boolean
    monthly_revenue: number
  }) => Promise<{ success: boolean; error?: string }>
  initialValues?: {
    id?: string
    name: string
    slug: string
    plan: Plan
    is_active: boolean
    ai_agent_enabled: boolean
    monthly_revenue: number
    pending_deletion_at?: string | null
  }
  onScheduleDeletion?: () => Promise<{ success: boolean; error?: string }>
  onCancelDeletion?: () => Promise<{ success: boolean; error?: string }>
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function OrganizationFormModal({
  isOpen,
  onClose,
  onSuccess,
  onSave,
  initialValues,
  onScheduleDeletion,
  onCancelDeletion,
}: OrganizationFormModalProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [slug, setSlug] = useState(initialValues?.slug ?? '')
  const [plan, setPlan] = useState<Plan>(initialValues?.plan ?? 'free')
  const [isActive, setIsActive] = useState(initialValues?.is_active ?? true)
  const [aiAgentEnabled, setAiAgentEnabled] = useState(initialValues?.ai_agent_enabled ?? false)
  const [monthlyRevenue, setMonthlyRevenue] = useState(initialValues?.monthly_revenue ?? 0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(initialValues?.name ?? '')
    setSlug(initialValues?.slug ?? '')
    setPlan(initialValues?.plan ?? 'free')
    setIsActive(initialValues?.is_active ?? true)
    setAiAgentEnabled(initialValues?.ai_agent_enabled ?? false)
    setMonthlyRevenue(initialValues?.monthly_revenue ?? 0)
    setError(null)
  }, [initialValues])

  const mode = initialValues ? 'edit' : 'create'
  const pendingDeletionAt = initialValues?.pending_deletion_at ?? null

  const handleNameChange = (value: string) => {
    setName(value)
    if (value.trim()) setSlug(generateSlug(value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!name.trim() || !slug.trim()) {
      setError('Nombre y slug son requeridos')
      setIsLoading(false)
      return
    }

    const result = await onSave({
      id: initialValues?.id,
      name,
      slug,
      plan,
      is_active: isActive,
      ai_agent_enabled: aiAgentEnabled,
      monthly_revenue: monthlyRevenue,
    })

    if (!result.success) {
      setError(result.error || 'Error guardando organización')
      setIsLoading(false)
      return
    }

    setName('')
    setSlug('')
    setPlan('free')
    setIsActive(true)
    setAiAgentEnabled(false)
    setMonthlyRevenue(0)
    onSuccess()
    onClose()
  }

  const handleToggleActive = async () => {
    const newValue = !isActive
    setError(null)
    setIsLoading(true)
    const result = await onSave({
      id: initialValues?.id,
      name,
      slug,
      plan,
      is_active: newValue,
      ai_agent_enabled: aiAgentEnabled,
      monthly_revenue: monthlyRevenue,
    })
    setIsLoading(false)
    if (!result.success) {
      setError(result.error || 'Error actualizando organización')
      return
    }
    setIsActive(newValue)
    onSuccess()
  }

  const handleScheduleDeletion = async () => {
    if (!onScheduleDeletion) return
    setError(null)
    setIsLoading(true)
    const result = await onScheduleDeletion()
    setIsLoading(false)
    if (!result.success) {
      setError(result.error || 'Error programando eliminación')
      return
    }
    onSuccess()
    onClose()
  }

  const handleCancelDeletion = async () => {
    if (!onCancelDeletion) return
    setError(null)
    setIsLoading(true)
    const result = await onCancelDeletion()
    setIsLoading(false)
    if (!result.success) {
      setError(result.error || 'Error cancelando eliminación')
      return
    }
    onSuccess()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'edit' ? 'Editar Organización' : 'Nueva Organización'}
          </h2>
          <button onClick={onClose} disabled={isLoading} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Organización</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isLoading}
              placeholder="ej. Clínica San Pedro"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Slug (Auto-generado)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isLoading}
              placeholder="clinica-san-pedro"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 font-mono text-xs bg-slate-50"
            />
            <p className="text-xs text-slate-500 mt-1">Identificador único para la organización</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              {PLAN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {mode === 'edit' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Revenue mensual (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">US$</span>
                  <input
                    type="number"
                    min={0}
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(parseInt(e.target.value) || 0)}
                    disabled={isLoading}
                    placeholder="0"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Cuánto paga este cliente por mes</p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="aiAgent"
                  type="checkbox"
                  checked={aiAgentEnabled}
                  onChange={(e) => setAiAgentEnabled(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="aiAgent" className="text-sm text-slate-700">Agente AI activado</label>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? (mode === 'edit' ? 'Guardando...' : 'Creando...') : mode === 'edit' ? 'Guardar cambios' : 'Crear'}
            </button>
          </div>

          {/* Danger Zone */}
          {mode === 'edit' && (
            <div className="border-t border-red-100 pt-4 mt-6">
              <h3 className="text-sm font-semibold text-red-600 mb-3">Zona de peligro</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleToggleActive}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {isActive ? 'Desactivar organización' : 'Reactivar organización'}
                </button>

                {pendingDeletionAt ? (
                  <div className="space-y-2">
                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-xs text-amber-800 font-medium">
                        ⏳ Eliminación programada para{' '}
                        {format(
                          new Date(new Date(pendingDeletionAt).getTime() + 24 * 3600 * 1000),
                          "dd MMM 'a las' HH:mm",
                          { locale: es }
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelDeletion}
                      disabled={isLoading}
                      className="w-full text-left px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                    >
                      Cancelar eliminación
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleScheduleDeletion}
                    disabled={isLoading || !onScheduleDeletion}
                    className="w-full text-left px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    Programar eliminación
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
