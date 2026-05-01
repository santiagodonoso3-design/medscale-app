'use client'

import { useState, useEffect } from 'react'
import {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  type Organization,
} from './actions'
import { OrganizationFormModal } from '@/components/admin/create-org-modal'
import { Building2, Plus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)

  const loadOrganizations = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getAllOrganizations()
      if (data) {
        setOrganizations(data)
      } else {
        setError('Error cargando organizaciones')
      }
    } catch (err) {
      setError('Error cargando organizaciones')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOrganizations()
  }, [])

  const handleSuccess = () => {
    setSelectedOrganization(null)
    loadOrganizations()
  }

  const handleEdit = (organization: Organization) => {
    setSelectedOrganization(organization)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('¿Eliminar esta organización? Esta acción no se puede deshacer.')
    if (!confirmed) return

    setActiveActionId(id)
    try {
      const result = await deleteOrganization(id)
      if (!result.success) {
        setError(result.error || 'Error eliminando organización')
      } else {
        loadOrganizations()
      }
    } catch (err) {
      setError('Error eliminando organización')
      console.error(err)
    } finally {
      setActiveActionId(null)
    }
  }

  const handleSave = async (payload: {
    id?: string
    name: string
    slug: string
    plan: 'starter' | 'growth' | 'enterprise'
    is_active: boolean
  }) => {
    if (payload.id) {
      return await updateOrganization(
        payload.id,
        payload.name,
        payload.slug,
        payload.plan,
        payload.is_active
      )
    }

    return await createOrganization(payload.name, payload.slug, payload.plan)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Organizaciones</h1>
          <p className="text-slate-600">Gestiona todas las organizaciones del sistema</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nueva Organización
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
            <p className="text-sm text-slate-600">Cargando organizaciones...</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && organizations.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Usuarios
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Fecha Creación
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-900">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-700">
                        {org.slug}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {org.plan === 'starter' && 'Starter'}
                        {org.plan === 'growth' && 'Growth'}
                        {org.plan === 'enterprise' && 'Enterprise'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          org.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {org.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{org.user_count}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {format(new Date(org.created_at), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(org)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(org.id)}
                        disabled={activeActionId === org.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {activeActionId === org.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && organizations.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            No hay organizaciones
          </h3>
          <p className="text-slate-600 mb-6">
            Crea la primera organización para comenzar
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            Crear Organización
          </button>
        </div>
      )}

      {/* Modal */}
      <OrganizationFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedOrganization(null)
        }}
        onSuccess={handleSuccess}
        onSave={handleSave}
        initialValues={selectedOrganization ?? undefined}
      />
    </div>
  )
}
