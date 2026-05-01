'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

interface OrganizationFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onSave: (payload: {
    id?: string
    name: string
    slug: string
    plan: 'starter' | 'growth' | 'enterprise'
    is_active: boolean
  }) => Promise<{ success: boolean; error?: string }>
  initialValues?: {
    id?: string
    name: string
    slug: string
    plan: 'starter' | 'growth' | 'enterprise'
    is_active: boolean
  }
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
}: OrganizationFormModalProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [slug, setSlug] = useState(initialValues?.slug ?? '')
  const [plan, setPlan] = useState<'starter' | 'growth' | 'enterprise'>(initialValues?.plan ?? 'starter')
  const [isActive, setIsActive] = useState(initialValues?.is_active ?? true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mode = initialValues ? 'edit' : 'create'

  const handleNameChange = (value: string) => {
    setName(value)
    if (value.trim()) {
      const generated = generateSlug(value)
      setSlug(generated)
    }
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
    })

    if (!result.success) {
      setError(result.error || 'Error guardando organización')
      setIsLoading(false)
      return
    }

    setName('')
    setSlug('')
    setPlan('starter')
    setIsActive(true)
    onSuccess()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'edit' ? 'Editar Organización' : 'Nueva Organización'}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre de la Organización
            </label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Slug (Auto-generado)
            </label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Plan
            </label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as 'starter' | 'growth' | 'enterprise')}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="starter">Starter - Básico</option>
              <option value="growth">Growth - Crecimiento</option>
              <option value="enterprise">Enterprise - Empresarial</option>
            </select>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-3">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">
                Organización activa
              </label>
            </div>
          )}

          {/* Buttons */}
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
        </form>
      </div>
    </div>
  )
}
