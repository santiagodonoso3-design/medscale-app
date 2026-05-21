'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Trash2, Plus, SlidersHorizontal } from 'lucide-react'
import { PermissionsModal, type PermissionsMember } from '@/components/team/permissions-modal'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Admin',
  staff: 'Colaborador',
  doctor: 'Médico',
}

const ROLE_BADGE: Record<string, string> = {
  owner:  'bg-accent/10 text-accent',
  staff:  'bg-slate-100 text-slate-600',
  doctor: 'bg-blue-50 text-blue-700',
}

interface Member {
  id: string
  user_id: string
  role: string
  doctor_id: string | null
  created_at: string
  email: string
  permissions: Record<string, string> | null
}

interface Doctor {
  id: string
  metadata: any
}

interface TeamClientProps {
  orgId: string
  members: Member[]
  doctors: Doctor[]
  currentUserId: string
  doctorsWithSchedules: string[]
}

export function TeamClient({ orgId, members: initialMembers, doctors, currentUserId, doctorsWithSchedules }: TeamClientProps) {
  const supabase = createClient()
  const [members, setMembers] = useState(initialMembers)
  const [permissionsMember, setPermissionsMember] = useState<PermissionsMember | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'owner' | 'staff' | 'doctor'>('staff')
  const [inviteDoctorName, setInviteDoctorName] = useState('')
  const [inviteDoctorSpecialty, setInviteDoctorSpecialty] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleInvite() {
    if (!inviteEmail) return
    setInviting(true)
    setError(null)

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          doctor_name: inviteRole === 'doctor' ? inviteDoctorName : null,
          doctor_specialty: inviteRole === 'doctor' ? inviteDoctorSpecialty : null,
          org_id: orgId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error invitando usuario')

      showToast('Invitación enviada correctamente')
      setShowInvite(false)
      setInviteEmail('')
      setInviteRole('staff')
      setInviteDoctorName('')
      setInviteDoctorSpecialty('')
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(memberId: string, userId: string) {
    if (userId === currentUserId) return
    if (!confirm('¿Eliminar este miembro del equipo?')) return

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)

    if (error) { showToast('Error eliminando miembro'); return }
    setMembers(prev => prev.filter(m => m.id !== memberId))
    showToast('Miembro eliminado')
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (error) { showToast('Error actualizando rol'); return }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    showToast('Rol actualizado')
  }

  function handlePermissionsSaved(memberId: string, permissions: Record<string, string> | null) {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, permissions } : m))
    showToast('Permisos actualizados')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Organización</p>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Equipo</h1>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          <Plus className="h-4 w-4" />
          Invitar usuario
        </button>
      </div>

      {/* Members table */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Usuario</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Rol</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Desde</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {members.map(member => {
              const isOwner = member.role === 'owner'
              const isSelf  = member.user_id === currentUserId
              return (
                <tr
                  key={member.id}
                  onClick={() => !isOwner && setPermissionsMember(member)}
                  className={`transition-colors ${isOwner ? '' : 'cursor-pointer hover:bg-slate-50'}`}
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{member.email}</p>
                    {member.role === 'doctor' && member.doctor_id && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {doctors.find(d => d.id === member.doctor_id)?.metadata?.name ?? '—'}
                      </p>
                    )}
                    {member.role === 'doctor' && member.doctor_id && (
                      !doctorsWithSchedules.includes(member.doctor_id) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium mt-0.5">
                          ⚠️ Sin disponibilidad configurada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium mt-0.5">
                          ✓ Disponibilidad configurada
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                    {isSelf ? (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[member.role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="owner">Admin</option>
                        <option value="staff">Colaborador</option>
                        <option value="doctor">Médico</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {new Date(member.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {!isOwner && (
                        <button
                          onClick={() => setPermissionsMember(member)}
                          title="Editar permisos"
                          className="text-slate-300 hover:text-slate-600 transition"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          onClick={() => handleRemove(member.id, member.user_id)}
                          className="text-red-400 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-base font-bold text-slate-900">Invitar usuario</h2>
            <p className="text-sm text-slate-500">
              Se enviará un email de invitación. El usuario podrá crear su contraseña.
            </p>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="usuario@email.com"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rol</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'owner' | 'staff' | 'doctor')}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="owner">Admin</option>
                <option value="staff">Colaborador</option>
                <option value="doctor">Médico</option>
              </select>
            </div>
            {inviteRole === 'doctor' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Nombre completo del médico
                  </label>
                  <input
                    value={inviteDoctorName}
                    onChange={e => setInviteDoctorName(e.target.value)}
                    placeholder="Dr. Juan García"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Especialidad
                  </label>
                  <input
                    value={inviteDoctorSpecialty}
                    onChange={e => setInviteDoctorSpecialty(e.target.value)}
                    placeholder="Fertilidad, Ginecología..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar invitación
              </button>
              <button
                onClick={() => { setShowInvite(false); setError(null); setInviteDoctorName(''); setInviteDoctorSpecialty('') }}
                className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {permissionsMember && (
        <PermissionsModal
          member={permissionsMember}
          onClose={() => setPermissionsMember(null)}
          onSaved={handlePermissionsSaved}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl bg-slate-900 px-5 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
