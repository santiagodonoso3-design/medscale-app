'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'

interface CreateLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onCreateLead: (payload: {
    full_name: string
    phone: string
    email: string
    source: string
    notes: string
  }) => Promise<{ success: boolean; error?: string }>
}

const sourceOptions = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'other', label: 'Otro' },
]

export function CreateLeadModal({ isOpen, onClose, onSuccess, onCreateLead }: CreateLeadModalProps) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState('whatsapp')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!fullName.trim() || !phone.trim()) {
      setError('Nombre y teléfono son requeridos')
      return
    }

    setIsLoading(true)
    const result = await onCreateLead({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      source,
      notes: notes.trim(),
    })

    if (!result.success) {
      setError(result.error || 'Error guardando lead')
      setIsLoading(false)
      return
    }

    setFullName('')
    setPhone('')
    setEmail('')
    setSource('whatsapp')
    setNotes('')
    setIsLoading(false)
    onSuccess()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nuevo Lead</h2>
            <p className="text-sm text-slate-500">Agregar un lead manualmente al CRM</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej. Juan Pérez"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej. +56912345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej. juan@cliente.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fuente</label>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isLoading}
              className="w-full min-h-[110px] rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Comentarios, observaciones o contexto"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
