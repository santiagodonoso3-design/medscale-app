'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save } from 'lucide-react'

const EVENTS = [
  {
    key: 'confirmation',
    label: 'Confirmación',
    desc: 'Se envía al paciente cuando agenda su cita',
    hasHours: false,
  },
  {
    key: 'reminder',
    label: 'Recordatorio',
    desc: 'Aviso previo a la cita',
    hasHours: true,
  },
  {
    key: 'cancellation',
    label: 'Cancelación',
    desc: 'Se envía cuando se cancela la cita',
    hasHours: false,
  },
  {
    key: 'reschedule',
    label: 'Reagendamiento',
    desc: 'Se envía cuando se cambia la fecha/hora',
    hasHours: false,
  },
]

interface NotifConfig {
  enabled: boolean
  to_patient: boolean
  to_clinic: boolean
  hours_before: number
}

type ConfigMap = Record<string, NotifConfig>

const DEFAULT_CONFIG: ConfigMap = {
  confirmation: { enabled: true,  to_patient: true,  to_clinic: false, hours_before: 0 },
  reminder:     { enabled: false, to_patient: true,  to_clinic: false, hours_before: 24 },
  cancellation: { enabled: false, to_patient: true,  to_clinic: false, hours_before: 0 },
  reschedule:   { enabled: false, to_patient: true,  to_clinic: false, hours_before: 0 },
}

export default function NotificationsPage() {
  const supabase = createClient()
  const [config, setConfig] = useState<ConfigMap>(DEFAULT_CONFIG)
  const [clinicEmails, setClinicEmails] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [typeIds, setTypeIds] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('organization_members').select('organization_id').eq('user_id', user.id).single()
      if (!member?.organization_id) return
      setOrgId(member.organization_id)

      const { data: types } = await supabase
        .from('appointment_types')
        .select('id')
        .eq('organization_id', member.organization_id)
        .eq('active', true)
      const ids = (types ?? []).map((t: any) => t.id)
      setTypeIds(ids)

      if (ids.length > 0) {
        const { data: notifs } = await supabase
          .from('appointment_type_notifications')
          .select('event_type, enabled, to_patient, to_clinic, hours_before')
          .eq('appointment_type_id', ids[0])
        if (notifs && notifs.length > 0) {
          const map: ConfigMap = { ...DEFAULT_CONFIG }
          notifs.forEach((n: any) => {
            if (map[n.event_type]) {
              map[n.event_type] = {
                enabled: n.enabled,
                to_patient: n.to_patient,
                to_clinic: n.to_clinic,
                hours_before: n.hours_before ?? 0,
              }
            }
          })
          setConfig(map)
        }
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('contact_email')
        .eq('id', member.organization_id)
        .single()
      if (org?.contact_email) setClinicEmails(org.contact_email)

      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!orgId || typeIds.length === 0) return
    setSaving(true)
    try {
      const rows: any[] = []
      typeIds.forEach(typeId => {
        EVENTS.forEach(ev => {
          const c = config[ev.key]
          rows.push({
            appointment_type_id: typeId,
            organization_id: orgId,
            event_type: ev.key,
            enabled: c.enabled,
            to_patient: c.to_patient,
            to_clinic: c.to_clinic,
            hours_before: c.hours_before,
          })
        })
      })

      const { error } = await supabase
        .from('appointment_type_notifications')
        .upsert(rows, { onConflict: 'appointment_type_id,event_type' })

      if (error) throw error

      await supabase
        .from('organizations')
        .update({ contact_email: clinicEmails.trim() })
        .eq('id', orgId)

      setToast('Configuración guardada')
      setTimeout(() => setToast(null), 3000)
    } catch {
      setToast('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  function updateConfig(key: string, field: keyof NotifConfig, value: any) {
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  if (loading) return (
    <div className="flex items-center gap-2 py-12 text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Notificaciones</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Aplica a todos los tipos de cita de la organización
        </p>
      </div>

      <div className="space-y-3">
        {EVENTS.map(ev => {
          const c = config[ev.key]
          return (
            <div key={ev.key} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{ev.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{ev.desc}</p>
                </div>
                <button
                  onClick={() => updateConfig(ev.key, 'enabled', !c.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${c.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${c.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {c.enabled && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={c.to_patient}
                      onChange={e => updateConfig(ev.key, 'to_patient', e.target.checked)}
                      className="rounded accent-blue-600" />
                    Notificar paciente
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={c.to_clinic}
                      onChange={e => updateConfig(ev.key, 'to_clinic', e.target.checked)}
                      className="rounded accent-blue-600" />
                    Notificar clínica
                  </label>
                  {ev.hasHours && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-slate-600">Horas antes</span>
                      <input
                        type="number" min={1} max={168}
                        value={c.hours_before}
                        onChange={e => updateConfig(ev.key, 'hours_before', Number(e.target.value))}
                        className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">Email de notificación interna</p>
        <p className="text-xs text-slate-400 mt-0.5 mb-3">
          Quién recibe los emails internos de nuevas citas, cancelaciones y reagendamientos
        </p>
        <input
          type="email"
          value={clinicEmails}
          onChange={e => setClinicEmails(e.target.value)}
          placeholder="admin@clinica.com"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-400 mt-1">
          Para múltiples destinatarios, sepáralos por coma
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar configuración
      </button>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl bg-slate-900 px-5 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
