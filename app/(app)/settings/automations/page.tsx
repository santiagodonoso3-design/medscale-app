'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Plus, Loader2, Pencil, X, Save, Zap, Calendar, Trash2, Users,
  Mail, Clock, Bell, GitBranch,
} from 'lucide-react'
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

interface RuleStats { sent_30d: number; last_sent_at: string | null }

const EMPTY_STATS: RuleStats = { sent_30d: 0, last_sent_at: null }

const EVENT_RULE_DEFS: RuleTypeDef[] = [
  {
    rule_type: 'followup_post_cita',
    defaultName: 'Reconecta después de la cita',
    defaultDescription: 'Un correo unos días después de la consulta para mantener la relación y motivar la próxima visita.',
    defaultDelay: 3,
    delayLabel: d => `${d} día${d !== 1 ? 's' : ''} después de cita completada`,
  },
  {
    rule_type: 'noshow_recovery',
    defaultName: 'Recupera pacientes que no asistieron',
    defaultDescription: 'Cuando un paciente no llega a su cita, este correo lo reconecta y facilita agendar de nuevo.',
    defaultDelay: 1,
    delayLabel: d => `${d} día${d !== 1 ? 's' : ''} después de no-show`,
  },
  {
    rule_type: 'procedure_followup',
    defaultName: 'Al iniciar tratamiento',
    defaultDescription: 'Un correo cuando el paciente pasa a "En tratamiento médico", con instrucciones o palabras de acompañamiento.',
    defaultDelay: 7,
    delayLabel: d => `${d} día${d !== 1 ? 's' : ''} después de iniciar tratamiento`,
  },
  {
    rule_type: 'procedure_completed',
    defaultName: 'Al finalizar tratamiento',
    defaultDescription: 'Un correo cuando el paciente completa su proceso, ideal para pedir referidos o dejar la puerta abierta.',
    defaultDelay: 0,
    delayLabel: d => d === 0 ? 'Al finalizar (próximo cron)' : `${d} días después de finalizar`,
  },
]

const BIRTHDAY_DEF: RuleTypeDef = {
  rule_type: 'birthday',
  defaultName: 'Felicitación de cumpleaños',
  defaultDescription: 'El día del cumpleaños del paciente le llega un correo tuyo, con la posibilidad de incluir un beneficio.',
  defaultDelay: null,
  delayLabel: () => 'El día del cumpleaños',
}

// lead_status: reglas por cambio de estado del lead (N por org). Misma forma
// que las demás defs para reusar RuleCard / openCreate.
const LEAD_STATUS_DEF: RuleTypeDef = {
  rule_type: 'lead_status',
  defaultName: 'Regla por estado del lead',
  defaultDescription: 'Envía un correo cuando un lead pasa a un estado específico de tu CRM.',
  defaultDelay: 0,
  delayLabel: days =>
    days > 0 ? `Se envía ${days} días después del cambio` : 'Se envía inmediatamente al cambio',
}

const ALL_RULE_DEFS: RuleTypeDef[] = [...EVENT_RULE_DEFS, BIRTHDAY_DEF, LEAD_STATUS_DEF]

// Notificaciones transaccionales de citas (appointment_type_notifications).
// Aquí solo el toggle masivo por evento; el copy por tipo de cita se edita en
// /settings/notifications.
const NOTIF_CARDS = [
  { event_type: 'confirmation', name: 'Confirmación de cita',
    description: 'Se envía cuando el paciente agenda una cita.' },
  { event_type: 'reminder', name: 'Recordatorio de cita',
    description: 'Se envía 24 horas antes de la cita.' },
  { event_type: 'cancellation', name: 'Notificación de cancelación',
    description: 'Se envía cuando se cancela una cita.' },
  { event_type: 'reschedule', name: 'Notificación de reagendamiento',
    description: 'Se envía cuando se reagenda una cita.' },
] as const

interface NotifSummary {
  event_type: string
  total_types: number
  enabled_count: number
  hours_before: number | null
}

// Reserved audience keys — application-level, not from catalog.
// Any other audience value is a lead_statuses.key of the org (loaded at runtime).
const RESERVED_AUDIENCES = [
  { value: 'all',      label: 'Todos los leads con email' },
  { value: 'birthday', label: 'Cumpleañeros del día' },
  { value: 'noshow',   label: 'Leads que no asistieron (no-show)' },
] as const

interface LeadStatus { key: string; label: string; sort_order: number; is_system: boolean }

// Variables the engine replaces in subject/body (lib/automations/process.ts)
const VARIABLES = ['nombre', 'nombre_clinica', 'nombre_doctor']

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

// CTA button the engine adds to this rule type's email (preview fidelity)
function ctaLabelFor(ruleType: string): string | undefined {
  return ruleType === 'noshow_recovery' ? 'Reagendar cita' : undefined
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'hace menos de 1 hora'
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `hace ${d}d`
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function formatTriggerDate(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// "Cuándo se envía" — read-only explainer derived from the rule type
function whenExplainer(ruleType: string, delayDays: string): string {
  switch (ruleType) {
    case 'followup_post_cita':
      return `Se envía ${delayDays || '?'} días después de que una cita se marca como completada.`
    case 'noshow_recovery':
      return `Se envía ${delayDays || '?'} días después de que una cita se marca como no-show.`
    case 'procedure_followup':
      return `Se envía ${delayDays || '?'} días después de que el lead pasa a "En tratamiento médico".`
    case 'procedure_completed':
      return `Se envía cuando el lead pasa a "Finalizado".`
    case 'birthday':
      return 'Se envía el día del cumpleaños del paciente (mismo día).'
    case 'special_date':
      return 'Se envía una única vez, el día de la fecha configurada.'
    case 'lead_status':
      return `Se envía ${delayDays || 0} días después de que el lead pase a ese estado.`
    default:
      return 'Se envía según la configuración de la regla.'
  }
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

function RuleCard({
  rule, def, onEdit, onToggle, audienceLabel = null, stats,
}: {
  rule: AutomationRule | null
  def: RuleTypeDef
  onEdit: () => void
  onToggle: () => void
  audienceLabel?: string | null // resolved by the parent (it owns the audience label map)
  stats?: RuleStats
}) {
  if (!rule) {
    // SIN CONFIGURAR: dashed border, not a greyed-out card
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 hover:border-blue-300 transition">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="font-semibold text-slate-900">{def.defaultName}</p>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-3">{def.defaultDescription}</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 shrink-0">
            Sin configurar
          </span>
        </div>
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

  // CONFIGURADA
  const active = rule.is_active
  return (
    <div
      onClick={onEdit}
      className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {active ? 'Activa' : 'Pausada'}
            </span>
          </div>
          <p className="font-semibold text-slate-900 truncate">{rule.name}</p>
          {rule.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{rule.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Toggle active={active} onClick={onToggle} />
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>
            {rule.delay_days !== null ? def.delayLabel(rule.delay_days) : def.delayLabel(0)}
          </span>
        </div>
        {audienceLabel && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{audienceLabel}</span>
          </div>
        )}
        {rule.email_subject && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{rule.email_subject}</span>
          </div>
        )}
      </div>

      {stats && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span><strong className="text-slate-700">{stats.sent_30d}</strong> correos en 30 días</span>
          <span>Último: {formatRelative(stats.last_sent_at)}</span>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// NotifCard — notificación transaccional de citas (toggle masivo por evento)
// ────────────────────────────────────────────────────────────────────────────

function NotifCard({
  card, summary, onToggle, disabled,
}: {
  card: { event_type: string; name: string; description: string }
  summary: NotifSummary | undefined
  onToggle: (enabled: boolean) => Promise<void>
  disabled: boolean
}) {
  const total        = summary?.total_types ?? 0
  const enabledCount = summary?.enabled_count ?? 0
  const isActive     = enabledCount > 0
  const [busy, setBusy] = useState(false)

  // El recordatorio muestra las horas reales configuradas si la org las tiene
  const description = card.event_type === 'reminder' && summary?.hours_before != null
    ? `Se envía ${summary.hours_before} horas antes de la cita.`
    : card.description

  async function handleToggle() {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onToggle(!isActive)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {isActive ? 'Activa' : 'Inactiva'}
            </span>
            {enabledCount > 0 && enabledCount < total && (
              <span className="text-[10px] text-slate-400">{enabledCount} de {total} tipos</span>
            )}
          </div>
          <p className="font-semibold text-slate-900">{card.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <div className={`flex items-center gap-2 shrink-0 ${busy || disabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <Toggle active={isActive} onClick={handleToggle} />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          {total > 0
            ? `Aplica a ${total} ${total === 1 ? 'tipo de cita' : 'tipos de cita'}`
            : 'Sin tipos de cita configurados'}
        </span>
        <Link
          href="/settings/notifications"
          className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline"
        >
          Personalizar por tipo →
        </Link>
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

  // ── Audience catalog (lead_statuses of the org) ──
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

  // ── Stats (sent in the last 30 days, per rule) ──
  const [stats, setStats] = useState<Record<string, RuleStats>>({})

  useEffect(() => {
    fetch('/api/automations/stats')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, RuleStats>) => setStats(data))
      .catch(() => {})
  }, [rules.length]) // refresh when rules are created/deleted

  // ── Appointment notifications (transactional) — summary + mass toggle ──
  const [notifSummary, setNotifSummary] = useState<NotifSummary[]>([])
  const [notifLoading, setNotifLoading] = useState(true)

  useEffect(() => {
    fetch('/api/appointment-notifications/summary')
      .then(r => r.ok ? r.json() : [])
      .then((data: NotifSummary[]) => {
        setNotifSummary(data)
        setNotifLoading(false)
      })
      .catch(() => setNotifLoading(false))
  }, [])

  async function handleNotifToggle(event_type: string, enabled: boolean) {
    const res = await fetch('/api/appointment-notifications/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, enabled }),
    })
    if (res.ok) {
      setNotifSummary(prev => prev.map(s =>
        s.event_type === event_type
          ? { ...s, enabled_count: enabled ? s.total_types : 0 }
          : s
      ))
    } else {
      const err = await res.json().catch(() => ({}))
      alert('Error al actualizar: ' + (err.error ?? 'Intenta de nuevo'))
    }
  }

  // ── lead_status rules (N per org) ──
  const leadStatusRules = useMemo(
    () => rules.filter(r => r.rule_type === 'lead_status'),
    [rules],
  )

  // Solo estados reales del CRM (sin reservadas all/birthday/noshow)
  const leadStatusOnlyOptions = useMemo(
    () => leadStatuses.map(s => ({ value: s.key, label: s.label })),
    [leadStatuses],
  )

  // ── Modal derived values (needed by the preview effect below) ──
  const modalRuleType   = editing?.rule_type ?? creatingType ?? ''
  const modalDef        = ALL_RULE_DEFS.find(d => d.rule_type === modalRuleType)
  const isLeadStatus    = modalRuleType === 'lead_status'
  const showDelay       = isEventBased(modalRuleType)
  const showTriggerDate = modalRuleType === 'special_date'
  const showAudience    = modalRuleType !== '' && (!isEventBased(modalRuleType) || isLeadStatus)
  const showDelete      = editing?.rule_type === 'special_date' || editing?.rule_type === 'lead_status'

  // ── Email preview + test send ──
  const [previewHtml, setPreviewHtml]       = useState<string>('')
  const [previewSubject, setPreviewSubject] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [testSending, setTestSending]       = useState(false)
  const [testResult, setTestResult]         = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!modalOpen) return
    if (!form.email_subject.trim() || !form.email_body.trim()) {
      setPreviewHtml('')
      setPreviewSubject('')
      return
    }
    // Debounce: re-render 500ms after the last keystroke
    const handle = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const res = await fetch('/api/automations/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject:  form.email_subject,
            body:     form.email_body,
            ctaLabel: ctaLabelFor(modalRuleType),
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setPreviewHtml(data.html)
          setPreviewSubject(data.subject)
        }
      } catch {
        // keep the last rendered preview
      } finally {
        setPreviewLoading(false)
      }
    }, 500)
    return () => clearTimeout(handle)
  }, [form.email_subject, form.email_body, modalOpen, modalRuleType])

  async function handleSendTest() {
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/automations/preview/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject:  form.email_subject,
          body:     form.email_body,
          ctaLabel: ctaLabelFor(modalRuleType),
        }),
      })
      const data = await res.json()
      // 400 = contact_email no configurado → el mensaje del endpoint va tal cual
      setTestResult(res.ok ? `Enviado a ${data.sent_to}` : (data.error ?? 'Error al enviar'))
    } catch {
      setTestResult('Error al enviar')
    } finally {
      setTestSending(false)
    }
  }

  // Inserts {{variable}} at the cursor position of the body textarea
  function insertVariable(v: string) {
    const el = bodyRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const token = `{{${v}}}`
    const nextValue = form.email_body.slice(0, start) + token + form.email_body.slice(end)
    setForm(p => ({ ...p, email_body: nextValue }))
    // reposition the cursor right after the token
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + token.length
    })
  }

  function resetPreview() {
    setPreviewHtml('')
    setPreviewSubject('')
    setTestResult(null)
  }

  function getRuleByType(ruleType: string) {
    return rules.find(r => r.rule_type === ruleType) ?? null
  }

  function getSpecialDates() {
    return rules.filter(r => r.rule_type === 'special_date')
  }

  function openCreate(ruleType: string) {
    const def = ALL_RULE_DEFS.find(d => d.rule_type === ruleType)
    const defaultAudience = ruleType === 'birthday'
      ? 'birthday'
      : ruleType === 'lead_status'
        ? (leadStatuses[0]?.key ?? '')
        : 'all'
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
    resetPreview()
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
    resetPreview()
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setCreatingType(null)
    setFormError(null)
    resetPreview()
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
    const hasAudience = !eventBased || isLeadStatus

    if (eventBased) {
      const days = Number(form.delay_days)
      if (form.delay_days === '' || isNaN(days) || days < 0) {
        setFormError('Ingresa un número de días válido (0 o más)'); return
      }
      if (isLeadStatus && days > 365) {
        setFormError('El máximo es 365 días'); return
      }
    }
    if (isSpecial && !form.trigger_date) {
      setFormError('La fecha es obligatoria'); return
    }
    if (isLeadStatus && !form.audience) {
      setFormError('Elige el estado que dispara el correo'); return
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
      audience:      isLeadStatus ? form.audience : (hasAudience ? (form.audience || 'all') : null),
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

  const specialDates = getSpecialDates()
  const modalSubtitle = editing?.name ?? modalDef?.defaultName ?? (showTriggerDate ? 'Fecha especial' : '')

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-slate-900">Automatizaciones</h2>
        <p className="text-sm text-slate-500">
          Correos automáticos a tus pacientes según lo que pasa en tu clínica.
        </p>
      </div>

      {/* Banner informativo permanente */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <span>Solo email por ahora. WhatsApp llega pronto.</span>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <span>Envío diario a las 9:00 AM (hora Colombia).</span>
          </div>
          <div className="flex items-start gap-2">
            <Bell className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <span>
              Los recordatorios de cita están en{' '}
              <Link href="/settings/notifications" className="text-blue-600 hover:underline">
                Notificaciones
              </Link>.
            </span>
          </div>
        </div>
      </div>

      {/* Section 0: Appointment notifications (transactional, mass toggle by event) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Notificaciones de citas
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {NOTIF_CARDS.map(card => (
            <NotifCard
              key={card.event_type}
              card={card}
              summary={notifSummary.find(s => s.event_type === card.event_type)}
              onToggle={enabled => handleNotifToggle(card.event_type, enabled)}
              disabled={notifLoading}
            />
          ))}
        </div>
      </div>

      {/* Section 1: Event-based */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Cuando pasa algo en tu clínica</p>
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
                stats={rule ? (stats[rule.id] ?? EMPTY_STATS) : undefined}
              />
            )
          })}
        </div>
      </div>

      {/* Section 2: Date-based */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              En fechas específicas
            </p>
          </div>
          <button
            onClick={() => openCreate('special_date')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva fecha especial
          </button>
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
                stats={rule ? (stats[rule.id] ?? EMPTY_STATS) : undefined}
              />
            )
          })()}

          {/* Special dates — multiple. Same visual pattern as RuleCard (inline on purpose) */}
          {specialDates.map(rule => {
            const active = rule.is_active
            const ruleStats = stats[rule.id] ?? EMPTY_STATS
            const audienceLabel = audienceLabelFor(rule.audience)
            return (
              <div
                key={rule.id}
                onClick={() => openEdit(rule)}
                className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {active ? 'Activa' : 'Pausada'}
                      </span>
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700">
                        Fecha especial
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 truncate">{rule.name}</p>
                    {rule.description && (
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Toggle active={active} onClick={() => handleToggle(rule)} />
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(rule) }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  {rule.trigger_date && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{formatTriggerDate(rule.trigger_date)}</span>
                    </div>
                  )}
                  {audienceLabel && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{audienceLabel}</span>
                    </div>
                  )}
                  {rule.email_subject && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{rule.email_subject}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span><strong className="text-slate-700">{ruleStats.sent_30d}</strong> correos en 30 días</span>
                  <span>Último: {formatRelative(ruleStats.last_sent_at)}</span>
                </div>
              </div>
            )
          })}

          {/* Empty state: no special dates yet */}
          {specialDates.length === 0 && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aún no tienes fechas especiales.</p>
              <p className="text-xs text-slate-400 mt-1">
                Crea una para enviar un correo puntual en una fecha específica —
                ideal para campañas o celebraciones.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Lead status rules (N per org) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-500" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Por cambio de estado del lead
            </p>
          </div>
          <button
            onClick={() => openCreate('lead_status')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva regla por estado
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {leadStatusRules.length === 0 ? (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <GitBranch className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aún no tienes reglas por cambio de estado.</p>
              <p className="text-xs text-slate-400 mt-1">
                Crea una para enviar un correo cuando un lead pasa a un estado específico —
                ejemplo: cuando pasa a &quot;En tratamiento médico&quot;.
              </p>
            </div>
          ) : (
            leadStatusRules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                def={LEAD_STATUS_DEF}
                onEdit={() => openEdit(rule)}
                onToggle={() => handleToggle(rule)}
                audienceLabel={rule.audience ? (audienceLabelMap[rule.audience] ?? rule.audience) : null}
                stats={stats[rule.id] ?? EMPTY_STATS}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal: form (left) + live preview (right) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 flex w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[90vh] max-w-4xl overflow-hidden">

            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">
                  {editing ? 'Editar automatización' : 'Configurar automatización'}
                </h2>
                {modalSubtitle && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{modalSubtitle}</p>
                )}
              </div>
              <button onClick={closeModal} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body: two columns on desktop (independent scroll), stacked on mobile */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

              {/* Left: form */}
              <div className="md:w-1/2 md:min-h-0 md:overflow-y-auto px-6 py-5 space-y-6">

                {/* Nombre / descripción */}
                <section className="space-y-3">
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
                </section>

                {/* Cuándo se envía */}
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cuándo se envía</p>
                  <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                    <Clock className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                    <span>{whenExplainer(modalRuleType, form.delay_days)}</span>
                  </div>

                  {showDelay && (
                    <div>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={isLeadStatus ? 365 : undefined}
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
                      <label className="text-xs text-slate-500">Fecha *</label>
                      <div className="mt-1">
                        <DatePicker
                          value={form.trigger_date}
                          onChange={(d) => setForm(p => ({ ...p, trigger_date: d }))}
                          placeholder="Seleccionar fecha"
                        />
                      </div>
                    </div>
                  )}
                </section>

                {/* A quién */}
                {showAudience && (
                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {isLeadStatus ? 'Cuando el lead pasa al estado' : 'A quién'}
                    </p>
                    <select
                      value={form.audience}
                      disabled={!statusesLoaded}
                      onChange={e => setForm(p => ({ ...p, audience: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    >
                      {isLeadStatus && statusesLoaded && leadStatusOnlyOptions.length === 0 && (
                        <option value="">Sin estados activos en tu CRM</option>
                      )}
                      {isLeadStatus && statusesLoaded && form.audience && !leadStatusOnlyOptions.some(o => o.value === form.audience) && (
                        <option value={form.audience}>{form.audience} (inactivo)</option>
                      )}
                      {(isLeadStatus ? leadStatusOnlyOptions : audienceOptions).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {isLeadStatus && (
                      <p className="text-xs text-slate-400">
                        Solo estados activos de tu CRM. Cada lead recibe este correo una sola vez por estado.
                      </p>
                    )}
                  </section>
                )}

                {/* Contenido del correo */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contenido del correo</p>
                  <div>
                    <label className="text-xs text-slate-500">Asunto *</label>
                    <input
                      value={form.email_subject}
                      onChange={e => setForm(p => ({ ...p, email_subject: e.target.value }))}
                      placeholder="Ej: ¿Cómo te fue en tu cita, {{nombre}}?"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs text-slate-500">Cuerpo *</label>
                      <div className="flex flex-wrap gap-1">
                        {VARIABLES.map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => insertVariable(v)}
                            title={`Insertar {{${v}}}`}
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-700 transition"
                          >
                            {`{{${v}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      ref={bodyRef}
                      value={form.email_body}
                      onChange={e => setForm(p => ({ ...p, email_body: e.target.value }))}
                      rows={8}
                      placeholder={'Hola {{nombre}},\n\nQueremos saber cómo te encuentras después de tu cita con {{nombre_doctor}}...'}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </section>

                {/* Estado */}
                {editing && (
                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</p>
                    <button
                      type="button"
                      onClick={() => setIsActive(v => !v)}
                      className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-sm font-medium transition ${
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
                  </section>
                )}

                {/* Zona de peligro */}
                {showDelete && (
                  <section className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-3">Zona de peligro</p>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="w-full border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-red-100 transition flex items-center justify-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar automatización
                    </button>
                  </section>
                )}
              </div>

              {/* Right: preview */}
              <div className="md:w-1/2 md:min-h-0 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50 flex flex-col md:overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-3 flex items-center justify-between shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa</p>
                  {previewLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                </div>
                <div className="flex-1 md:min-h-0 md:overflow-y-auto p-4">
                  {previewSubject && (
                    <div className="rounded-lg bg-white border border-slate-200 p-3 mb-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Asunto</p>
                      <p className="text-sm font-semibold text-slate-900">{previewSubject}</p>
                    </div>
                  )}
                  <div className="rounded-lg bg-white border border-slate-200 overflow-hidden" style={{ minHeight: 400 }}>
                    {previewHtml ? (
                      <iframe
                        srcDoc={previewHtml}
                        sandbox=""
                        className="w-full h-[500px] border-0"
                        title="Preview del correo"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-[500px] text-xs text-slate-400 p-6 text-center">
                        Escribe un asunto y cuerpo para ver la vista previa
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-100 px-6 py-4 space-y-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={testSending || !form.email_subject || !form.email_body}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Enviar prueba al correo de contacto
                  </button>
                  {testResult && (
                    <p className={`text-xs text-center ${testResult.startsWith('Enviado') ? 'text-emerald-700' : 'text-red-600'}`}>
                      {testResult}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="shrink-0 border-t border-slate-100 px-6 py-4 space-y-3">
              {formError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
              )}
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
