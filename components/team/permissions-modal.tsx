'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  getUserPermissions,
  getConfigurableModules,
  type ModulePermissions,
  type PermissionLevel,
  type Role,
} from '@/lib/permissions'

const MODULE_LABELS: Record<string, string> = {
  dashboard:     'Dashboard',
  crm:           'CRM',
  scheduling:    'Agenda',
  conversations: 'Conversaciones',
  doctors:       'Doctores',
}

const LEVEL_OPTIONS: { value: PermissionLevel; label: string }[] = [
  { value: 'none', label: 'Sin acceso' },
  { value: 'read', label: 'Solo lectura' },
  { value: 'full', label: 'Completo' },
]

const ROLE_BADGE: Record<string, string> = {
  staff:  'bg-slate-100 text-slate-600',
  doctor: 'bg-blue-50 text-blue-700',
}

const ROLE_LABELS: Record<string, string> = {
  staff:  'Colaborador',
  doctor: 'Médico',
}

export interface PermissionsMember {
  id: string
  email: string
  role: string
  permissions: Record<string, string> | null
}

interface PermissionsModalProps {
  member: PermissionsMember
  onClose: () => void
  onSaved: (memberId: string, permissions: Record<string, string> | null) => void
}

export function PermissionsModal({ member, onClose, onSaved }: PermissionsModalProps) {
  const modules = getConfigurableModules()
  const role = member.role as Role

  const effective = getUserPermissions(role, member.permissions)
  const defaults  = getUserPermissions(role, null)

  const [form, setForm]     = useState<ModulePermissions>({ ...effective })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)

    // Only persist overrides that differ from role defaults
    const diff: Record<string, string> = {}
    for (const mod of modules) {
      if (form[mod] !== defaults[mod]) diff[mod] = form[mod]
    }
    const permissions = Object.keys(diff).length === 0 ? null : diff

    try {
      const res = await fetch('/api/team/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, permissions }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error guardando permisos')
      }
      onSaved(member.id, permissions)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando permisos')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setForm({ ...defaults })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{member.email}</p>
            <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[member.role] ?? 'bg-slate-100 text-slate-600'}`}>
              {ROLE_LABELS[member.role] ?? member.role}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {member.role === 'doctor' && (
            <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-700">
              Solo verá su propia información en los módulos habilitados.
            </p>
          )}

          <div className="space-y-4">
            {modules.map(mod => (
              <div key={mod}>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  {MODULE_LABELS[mod] ?? mod}
                </p>
                <div className="flex gap-2">
                  {LEVEL_OPTIONS.map(opt => {
                    const active = form[mod] === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setForm(p => ({ ...p, [mod]: opt.value }))}
                        className={[
                          'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition',
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline"
          >
            Restablecer defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
