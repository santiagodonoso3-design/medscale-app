'use client'

import { useState, useEffect } from 'react'
import {
  getPlatformAdmins,
  getAssignableOrganizations,
  promoteUserToAdmin,
  updateAdminAccess,
  revokeAdmin,
  type PlatformAdminRow,
} from './actions'
import { Users, Plus, Loader2, Pencil, UserMinus, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'support', label: 'Soporte' },
]

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global — todas las clínicas' },
  { value: 'assigned', label: 'Asignado — solo clínicas seleccionadas' },
]

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-violet-100 text-violet-700',
  admin: 'bg-blue-100 text-blue-700',
  support: 'bg-slate-100 text-slate-700',
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  support: 'Soporte',
}

export default function UsersPage() {
  const [admins, setAdmins] = useState<PlatformAdminRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<PlatformAdminRow | null>(null)
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('support')
  const [scope, setScope] = useState('global')
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])

  const loadAdmins = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getPlatformAdmins()
      if (data) {
        setAdmins(data)
      } else {
        setError('Error cargando administradores')
      }
    } catch (err) {
      setError('Error cargando administradores')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAdmins()
  }, [])

  const loadOrganizations = async () => {
    setOrgsLoading(true)
    try {
      const data = await getAssignableOrganizations()
      if (data) {
        setOrganizations(data)
      } else {
        setFormError('Error cargando clínicas')
      }
    } catch {
      setFormError('No autorizado para gestionar el equipo')
    } finally {
      setOrgsLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingAdmin(null)
    setEmail('')
    setRole('support')
    setScope('global')
    setSelectedOrgIds([])
    setFormError(null)
    setIsModalOpen(true)
    loadOrganizations()
  }

  const openEditModal = (admin: PlatformAdminRow) => {
    setEditingAdmin(admin)
    setEmail(admin.email)
    setRole(admin.role)
    setScope(admin.scope)
    setSelectedOrgIds(admin.organization_ids)
    setFormError(null)
    setIsModalOpen(true)
    loadOrganizations()
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingAdmin(null)
    setFormError(null)
  }

  const toggleOrg = (orgId: string) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setIsSaving(true)
    try {
      const orgIds = scope === 'assigned' ? selectedOrgIds : []
      const result = editingAdmin
        ? await updateAdminAccess(editingAdmin.id, role, scope, orgIds)
        : await promoteUserToAdmin(email, role, scope, orgIds)

      if (result.success) {
        closeModal()
        loadAdmins()
      } else {
        setFormError(result.error || 'Error guardando cambios')
      }
    } catch {
      setFormError('No autorizado para gestionar el equipo')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevoke = async (admin: PlatformAdminRow) => {
    if (!window.confirm(`¿Revocar el acceso al panel de ${admin.email}? Su cuenta de MedScale no se elimina.`)) {
      return
    }
    setError(null)
    try {
      const result = await revokeAdmin(admin.id)
      if (result.success) {
        loadAdmins()
      } else {
        setError(result.error || 'Error revocando acceso')
      }
    } catch {
      setError('No autorizado para gestionar el equipo')
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Equipo de MedScale</h1>
          <p className="text-slate-600">Administra quién tiene acceso al panel y sobre qué clínicas</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="h-5 w-5" />
          Agregar administrador
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Cargando administradores...</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && admins.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Rol</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Alcance</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Fecha</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr
                    key={admin.id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-900">{admin.email}</span>
                        {admin.is_self && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Tú
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[admin.role] ?? 'bg-slate-100 text-slate-700'}`}>
                        {ROLE_LABEL[admin.role] ?? admin.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {admin.scope === 'global' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Global
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {admin.organization_ids.length}{' '}
                          {admin.organization_ids.length === 1 ? 'clínica' : 'clínicas'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {format(new Date(admin.created_at), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4">
                      {admin.is_self ? (
                        <span className="text-sm text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(admin)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(admin)}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 transition-colors"
                          >
                            <UserMinus className="h-4 w-4" />
                            Revocar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && admins.length === 0 && !error && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No hay administradores</h3>
          <p className="text-slate-600">Agrega el primer administrador del equipo</p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingAdmin ? 'Editar administrador' : 'Agregar administrador'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={!!editingAdmin}
                  placeholder="persona@correo.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                />
                {!editingAdmin && (
                  <p className="mt-1 text-xs text-slate-500">
                    La persona ya debe haber iniciado sesión en MedScale con Google.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alcance</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {scope === 'assigned' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Clínicas</label>
                  {orgsLoading ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando clínicas...
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {organizations.length === 0 && (
                        <p className="px-3 py-3 text-sm text-slate-500">No hay clínicas activas</p>
                      )}
                      {organizations.map((org) => (
                        <label
                          key={org.id}
                          className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedOrgIds.includes(org.id)}
                            onChange={() => toggleOrg(org.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          {org.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingAdmin ? 'Guardar cambios' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
