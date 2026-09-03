'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Loader2, Pencil, X, Save, Zap, Calendar, Trash2, Users } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'

interface AutomationRule {
  id: string
  rule_type: string
  name: string
  description: string | null
  delay_days: number | null
  trigger_date: string | null
  email_subject: string | null
  email_body: string | null
  audience: string | null
  is_active: boolean
  created_at: string
}

interface RuleTypeDef {
  rule_type: string
  defaultName: string
  defaultDescription: string
  defaultDelay: number | null
  delayLabel: (delay: number) => string
}

const EVENT_RULE_DEFS: RuleTypeDef[] = [
  {
    rule_type: 'followup_post_cita',
    defaultName: 'Seguimiento post cita',
    defaultDescription: 'Email de seguimiento enviado días después de una cita completada.',
    defaultDelay: 3,
    delayLabel: d => `${d} día${d !== 1 ? 's' : ''} después de cita completada`,
  },
  {
    rule_type: 'noshow_recovery',
    defaultName: 'Recuperación no-show',
    defaultDescription: 'Email de recuperación enviado a pacientes que no asistieron a su cita.',
    defaultDelay: 1,
    delayLabel: d => `${d} día${d !== 1 ? 's' : ''} después de no-show`,
  },
  {
    rule_type: 'procedure_followup',
    defaultName: 'Seguimiento procedimiento',
    defaultDescription: 'Email enviado cuando el lead inicia tratamiento médico.',
    defaultDelay: 7,
    delayLabel: d => `${d} día${d !== 1 ? 's' : ''} después de iniciar tratamiento`,
  },
  {
    rule_type: 'procedure_completed',
    defaultName: 'Procedimiento finalizado',
    defaultDescription: 'Email enviado cuando el lead pasa a estado finalizado.',
    defaultDelay: 0,
    delayLabel: d => d === 0 ? 'Al finalizar (próximo cron)' : `${d} días después de finalizar`,
  },
]

const BIRTHDAY_DEF: RuleTypeDef = {
  rule_type: 'birthday',
  defaultName: 'Cumpleaños',
  defaultDescription: 'Email de felicitación enviado el día del cumpleaños del paciente.',
  defaultDelay: null,
  delayLabel: () => 'El día del cumpleaños',
}

// Reserved audience keys — application-level, not from catalog.
// Any other audience value is a lead_statuses.key of the org (loaded at runtime).
const RESERVED_AUDIENCES = [
  { value: 'all',      label: 'Todos los leads con email' },
  { value: 'birthday', label: 'Cumpleañeros del día' },
  { value: 'noshow',   label: 'Leads que no asistieron (no-show)' },
] as const

interface LeadStatus { key: string; label: string; sort_order: number; is_system: boolean }

const EMPTY_FORM = {
  name: '',
  description: '',
  delay_days: '',
  trigger_date: '',
  email_subject: '',
  email_body: '',
  audience: 'all',
}

function isEventBased(ruleType: string) {
  return ruleType !== 'birthday' && ruleType !== 'special_date'
}

// ────────────────────────────────────────────────────────────────────────────
// RuleCard
// ────────────────────────────────────────────────────────────────────────────

function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function AudienceChip({ label }: { label: string | null }) {
  if (!label) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 mt-1">
      <Users className="h-3 w-3" />
      {label}
    </span>
  )
}

function RuleCard({
  rule,
  def,
  onEdit,
  onToggle,
  audienceLabel = null,
}: {
  rule: AutomationRule | null
  def: RuleTypeDef
  onEdit: () => void
  onToggle: () => void
  audienceLabel?: string | null // resolved by the parent (it owns the audience label map)
}) {
  if (!rule) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
        <p className="font-semibold text-slate-400">{def.defaultName}</p>
        <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{def.defaultDescription}</p>
        <button
          onClick={onEdit}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Configurar
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={onEdit}
      className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate">{rule.name}</p>
          {rule.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{rule.description}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {rule.delay_days !== null
              ? def.delayLabel(rule.delay_days)
              : def.delayLabel(0)}
          </p>
          {rule.rule_type === 'birthday' && <AudienceChip label={audienceLabel} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Toggle active={rule.is_active} onClick={onToggle} />
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [rules, setRules]               = useState<AutomationRule[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editing, setEditing]           = useState<AutomationRule | null>(null)
  const [creatingType, setCreatingType] = useState<string | null>(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [isActive, setIsActive]         = useState(true)
  const [saving, setSaving]             = useState(false)
  const [formError, setFormError]       = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/automations')
    if (res.ok) setRules(await res.json())
    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const [leadStatuses, setLeadStatuses]     = useState<LeadStatus[]>([])
  const [statusesLoaded, setStatusesLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/lead-statuses')
      .then(r => r.ok ? r.json() : [])
      .then((data: LeadStatus[]) => {
        setLeadStatuses(data)
        setStatusesLoaded(true)
      })
      .catch(() => setStatusesLoaded(true))
  }, [])

  // Order: all → org statuses (by sort_order) → birthday → noshow
  const audienceOptions = useMemo(() => {
    const statusOpts = leadStatuses.map(s => ({ value: s.key, label: s.label }))
    return [
      RESERVED_AUDIENCES[0], // all
      ...statusOpts,
      RESERVED_AUDIENCES[1], // birthday
      RESERVED_AUDIENCES[2], // noshow
    ]
  }, [leadStatuses])

  const audienceLabelMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(audienceOptions.map(o => [o.value, o.label] as const)),
    [audienceOptions],
  )

  function audienceLabelFor(audience: string | null): string | null {
    if (!audience || audience === 'all') return null
    return audienceLabelMap[audience] ?? audience
  }

  function getRuleByType(ruleType: string) {
    return rules.find(r => r.rule_type === ruleType) ?? null
  }

  function getSpecialDates() {
    return rules.filter(r => r.rule_type === 'special_date')
  }

  function openCreate(ruleType: string) {
    const def = [...EVENT_RULE_DEFS, BIRTHDAY_DEF].find(d => d.rule_type === ruleType)
    const defaultAudience = ruleType === 'birthday' ? 'birthday' : 'all'
    setEditing(null)
    setCreatingType(ruleType)
    setForm({
      name: def?.defaultName ?? '',
      description: def?.defaultDescription ?? '',
      delay_days: def?.defaultDelay !== null && def?.defaultDelay !== undefined ? String(def.defaultDelay) : '',
      trigger_date: '',
      email_subject: '',
      email_body: '',
      audience: defaultAudience,
    })
    setIsActive(true)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(rule: AutomationRule) {
    setEditing(rule)
    setCreatingType(null)
    setForm({
      name: rule.name,
      description: rule.description ?? '',
      delay_days: rule.delay_days !== null ? String(rule.delay_days) : '',
      trigger_date: rule.trigger_date ? rule.trigger_date.slice(0, 10) : '',
      email_subject: rule.email_subject ?? '',
      email_body: rule.email_body ?? '',
      audience: rule.audience ?? 'all',
    })
    setIsActive(rule.is_active)
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setCreatingType(null)
    setFormError(null)
  }

  async function handleToggle(rule: AutomationRule) {
    const res = await fetch('/api/automations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r))
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.email_subject.trim()) { setFormError('El asunto del email es obligatorio'); return }
    if (!form.email_body.trim()) { setFormError('El cuerpo del email es obligatorio'); return }

    const ruleType    = editing?.rule_type ?? creatingType!
    const eventBased  = isEventBased(ruleType)
    const isSpecial   = ruleType === 'special_date'
    const hasAudience = !eventBased

    if (eventBased) {
      const days = Number(form.delay_days)
      if (form.delay_days === '' || isNaN(days) || days < 0) {
        setFormError('Ingresa un número de días válido (0 o más)'); return
      }
    }
    if (isSpecial && !form.trigger_date) {
      setFormError('La fecha es obligatoria'); return
    }

    setSaving(true)
    setFormError(null)

    const payload = {
      name:          form.name.trim(),
      description:   form.description.trim() || null,
      email_subject: form.email_subject.trim(),
      email_body:    form.email_body.trim(),
      is_active:     isActive,
      delay_days:    eventBased ? Number(form.delay_days) : null,
      trigger_date:  isSpecial ? form.trigger_date : null,
      audience:      hasAudience ? (form.audience || 'all') : null,
    }

    if (editing) {
      const res = await fetch('/api/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Error guardando'); setSaving(false); return }
      setRules(prev => prev.map(r => r.id === editing.id ? data : r))
    } else {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_type: ruleType, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Error creando'); setSaving(false); return }
      setRules(prev => [...prev, data])
    }

    setSaving(false)
    closeModal()
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm('¿Eliminar esta automatización? Esta acción no se puede deshacer.')) return

    const res = await fetch('/api/automations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id }),
    })
    if (res.ok) {
      setRules(prev => prev.filter(r => r.id !== editing.id))
      closeModal()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
      </div>
    )
  }

  const modalRuleType   = editing?.rule_type ?? creatingType ?? ''
  const showDelay       = isEventBased(modalRuleType)
  const showTriggerDate = modalRuleType === 'special_date'
  const showAudience    = !isEventBased(modalRuleType) && modalRuleType !== ''
  const showDelete      = editing?.rule_type === 'special_date'

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Automatizaciones</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Emails automáticos enviados según eventos clínicos o fechas especiales.
          </p>
        </div>
        <button
          onClick={() => openCreate('special_date')}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Nueva automatización
        </button>
      </div>

      {/* Section: Event-based */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Basadas en eventos</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EVENT_RULE_DEFS.map(def => {
            const rule = getRuleByType(def.rule_type)
            return (
              <RuleCard
                key={def.rule_type}
                rule={rule}
                def={def}
                onEdit={() => rule ? openEdit(rule) : openCreate(def.rule_type)}
                onToggle={() => rule && handleToggle(rule)}
              />
            )
          })}
        </div>
      </div>

      {/* Section: Date-based */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Basadas en fecha</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Birthday — fixed, one per org */}
          {(() => {
            const rule = getRuleByType('birthday')
            return (
              <RuleCard
                rule={rule}
                def={BIRTHDAY_DEF}
                onEdit={() => rule ? openEdit(rule) : openCreate('birthday')}
                onToggle={() => rule && handleToggle(rule)}
                audienceLabel={audienceLabelFor(rule?.audience ?? null)}
              />
            )
          })()}

          {/* Special dates — multiple */}
          {getSpecialDates().map(rule => (
            <div
              key={rule.id}
              onClick={() => openEdit(rule)}
              className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                    Fecha especial
                  </span>
                  <p className="font-semibold text-slate-900 truncate mt-1">{rule.name}</p>
                  {rule.trigger_date && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(rule.trigger_date + 'T12:00:00').toLocaleDateString('es-CO', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  )}
                  <AudienceChip label={audienceLabelFor(rule.audience)} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Toggle active={rule.is_active} onClick={() => handleToggle(rule)} />
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(rule) }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 flex w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[90vh] max-w-lg">

            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? 'Editar automatización' : 'Configurar automatización'}
              </h2>
              <button onClick={closeModal} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Seguimiento post cirugía"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Descripción</label>
                <input
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Descripción opcional"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {showDelay && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Días de espera *</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.delay_days}
                      onChange={e => setForm(p => ({ ...p, delay_days: e.target.value }))}
                      className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-500">días después del evento</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Usa 0 para enviar en el próximo cron del mismo día.</p>
                </div>
              )}

              {showTriggerDate && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha *</label>
                  <div className="mt-1">
                    <DatePicker
                      value={form.trigger_date}
                      onChange={(d) => setForm(p => ({ ...p, trigger_date: d }))}
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                </div>
              )}

              {showAudience && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Enviar a</label>
                  <select
                    value={form.audience}
                    disabled={!statusesLoaded}
                    onChange={e => setForm(p => ({ ...p, audience: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  >
                    {audienceOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Asunto del email *</label>
                <input
                  value={form.email_subject}
                  onChange={e => setForm(p => ({ ...p, email_subject: e.target.value }))}
                  placeholder="Ej: ¿Cómo te fue en tu cita, {{nombre}}?"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cuerpo del email *</label>
                <textarea
                  value={form.email_body}
                  onChange={e => setForm(p => ({ ...p, email_body: e.target.value }))}
                  rows={6}
                  placeholder={'Hola {{nombre}},\n\nQueremos saber cómo te encuentras después de tu cita con {{nombre_doctor}}...'}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Variables:{' '}
                  <code className="bg-slate-100 px-1 rounded">{'{{nombre}}'}</code>{' '}
                  <code className="bg-slate-100 px-1 rounded">{'{{nombre_clinica}}'}</code>{' '}
                  <code className="bg-slate-100 px-1 rounded">{'{{nombre_doctor}}'}</code>
                </p>
              </div>

              {editing && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</label>
                  <button
                    type="button"
                    onClick={() => setIsActive(v => !v)}
                    className={`mt-2 flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </div>
                    {isActive ? 'Activa — se enviará según el cron' : 'Inactiva — no se enviarán emails'}
                  </button>
                </div>
              )}

              {formError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
              )}

              {showDelete && (
                <div className="border-t border-slate-200 pt-4 mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-3">Zona de peligro</p>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-red-100 transition flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar automatización
                  </button>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editing ? 'Guardar cambios' : 'Crear automatización'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
