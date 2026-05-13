'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, MessageCircle, Bot, ExternalLink, Loader2,
  Users, Calendar, BarChart3, CheckCircle,
} from 'lucide-react'
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns'
import { es } from 'date-fns/locale'

type Message = {
  id: string
  lead_id: string | null
  sender_phone: string | null
  sender_name: string | null
  direction: 'inbound' | 'outbound'
  content: string
  channel: string
  is_read: boolean | null
  created_at: string
}

type Lead = {
  id: string
  contact_name: string | null
  contact_phone: string | null
}

type Conversation = {
  key: string
  lead_id: string | null
  lead_name: string | null
  lead_phone: string | null
  channel: string
  last_message: string
  last_at: string
  unread: boolean
}

function relativeTime(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })
}

function dateSeparator(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d)) return 'Hoy'
  if (isYesterday(d)) return 'Ayer'
  return format(d, "d 'de' MMMM yyyy", { locale: es })
}

function channelBadge(channel: string) {
  if (channel === 'whatsapp') {
    return <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">WA</span>
  }
  if (channel === 'instagram') {
    return <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700">IG</span>
  }
  if (channel === 'facebook') {
    return <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: '#e7f0fd', color: '#1877F2' }}>FB</span>
  }
  return null
}

// ── Input / Label helpers ────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1'

// ── Agent Request Form ───────────────────────────────────────────────────────

function AgentRequestForm({ orgName, orgEmail, organizationId }: { orgName: string; orgEmail: string; organizationId: string }) {
  const [contactEmail, setContactEmail] = useState(orgEmail)
  const [contactPhone, setContactPhone] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [agentName, setAgentName] = useState('')
  const [tone, setTone] = useState('Formal y profesional')
  const [languages, setLanguages] = useState<string[]>(['Español'])
  const [objective, setObjective] = useState('Agendar citas de valoración')
  const [restrictions, setRestrictions] = useState('')
  const [services, setServices] = useState('')
  const [bookingLink, setBookingLink] = useState('')
  const [escalationPhone, setEscalationPhone] = useState('')
  const [schedule, setSchedule] = useState('')
  const [address, setAddress] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCheck = (arr: string[], val: string, set: (v: string[]) => void) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const canSubmit = termsAccepted && contactEmail && contactPhone && channels.length > 0 && agentName && services && !submitting

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/conversations/request-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: organizationId,
          org_name: orgName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          channels,
          agent_name: agentName,
          tone,
          languages,
          objective,
          restrictions,
          services,
          booking_link: bookingLink,
          escalation_phone: escalationPhone,
          schedule,
          address,
          additional_notes: additionalNotes,
          terms_accepted: termsAccepted,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Error enviando solicitud')
        setSubmitting(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Error de red. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-16 text-center">
          <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">¡Solicitud enviada!</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Nos pondremos en contacto contigo en las próximas 24 horas para configurar tu agente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">

        {/* Header */}
        <div className="p-8 text-center border-b border-slate-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 mx-auto mb-4">
            <Bot className="h-7 w-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Activa tu agente de conversaciones</h2>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
            Conecta WhatsApp, Instagram y Facebook para que un agente AI atienda a tus pacientes 24/7
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-2 gap-4 p-8 border-b border-slate-100">
          {[
            { icon: MessageCircle, label: 'Respuesta automática 24/7' },
            { icon: Users,         label: 'Calificación inteligente de leads' },
            { icon: Calendar,      label: 'Agendamiento desde la conversación' },
            { icon: BarChart3,     label: 'Historial completo de interacciones' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <Icon className="h-5 w-5 text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-slate-700">{label}</span>
            </div>
          ))}
        </div>

        <div className="p-8 space-y-8">

          {/* Sección 1: Información de contacto */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Información de contacto</h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Email de contacto <span className="text-red-500">*</span></label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Teléfono de contacto <span className="text-red-500">*</span></label>
                <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+57 300 000 0000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Canales a activar <span className="text-red-500">*</span></label>
                <div className="flex gap-4 mt-1">
                  {['WhatsApp', 'Instagram', 'Facebook'].map(ch => (
                    <label key={ch} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={channels.includes(ch)}
                        onChange={() => toggleCheck(channels, ch, setChannels)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">{ch}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sección 2: Personalidad del agente */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Personalidad del agente</h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nombre del agente <span className="text-red-500">*</span></label>
                <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Ej: Tatiana, Asistente Dra. López" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tono de comunicación</label>
                <select value={tone} onChange={e => setTone(e.target.value)} className={inputCls}>
                  <option>Formal y profesional</option>
                  <option>Cercano y cálido</option>
                  <option>Directo y conciso</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Idiomas</label>
                <div className="flex gap-4 mt-1">
                  {['Español', 'Inglés', 'Portugués'].map(lang => (
                    <label key={lang} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={languages.includes(lang)}
                        onChange={() => toggleCheck(languages, lang, setLanguages)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">{lang}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Objetivo principal</label>
                <select value={objective} onChange={e => setObjective(e.target.value)} className={inputCls}>
                  <option>Agendar citas de valoración</option>
                  <option>Informar sobre servicios y precios</option>
                  <option>Calificar leads antes de derivar</option>
                  <option>Todos los anteriores</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>¿Qué NO debe hacer o decir el agente?</label>
                <textarea
                  value={restrictions}
                  onChange={e => setRestrictions(e.target.value)}
                  rows={3}
                  placeholder="Ej: No mencionar precios de competidores, no prometer resultados específicos..."
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Sección 3: Información para el agente */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Información para el agente</h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Servicios que ofreces con precios <span className="text-red-500">*</span></label>
                <textarea
                  value={services}
                  onChange={e => setServices(e.target.value)}
                  rows={4}
                  placeholder={"Ej: Consulta general - $150.000\nEcografía - $200.000"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Link de agendamiento</label>
                <input type="url" value={bookingLink} onChange={e => setBookingLink(e.target.value)} placeholder="https://app.medscale.app/book/tu-clinica" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>WhatsApp para derivación humana</label>
                <input type="tel" value={escalationPhone} onChange={e => setEscalationPhone(e.target.value)} placeholder="+57 300 000 0000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Horario de atención</label>
                <input type="text" value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="Lunes a viernes 8am-6pm" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Dirección de la sede</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Información adicional</label>
                <textarea value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} rows={3} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Sección 4: Términos */}
          <div className="border-t border-slate-100 pt-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600"
              />
              <span className="text-xs text-slate-500 leading-relaxed">
                Confirmo que la información proporcionada sobre servicios, precios y procedimientos es verídica y está actualizada.
                Entiendo que el agente AI <strong>NO brinda diagnósticos, consejos médicos ni recomendaciones clínicas</strong>.
                El agente <strong>NO garantiza resultados</strong> de tratamientos. Toda interacción es informativa y orientativa,
                no sustituye la consulta médica profesional. Soy responsable de mantener actualizada la información.
                MedScale AI no se hace responsable por información incorrecta proporcionada para configurar el agente.
                {' '}Los mensajes se almacenan por un máximo de 48 horas y se eliminan automáticamente después de este período.
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-xl transition"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Enviando solicitud...' : 'Solicitar activación'}
          </button>

        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface ConversationsPageClientProps {
  organizationId: string
  aiAgentEnabled?: boolean
  orgName?: string
  orgEmail?: string
}

export function ConversationsPageClient({
  organizationId,
  aiAgentEnabled = false,
  orgName = '',
  orgEmail = '',
}: ConversationsPageClientProps) {

  if (!aiAgentEnabled) {
    return (
      <AgentRequestForm
        orgName={orgName}
        orgEmail={orgEmail}
        organizationId={organizationId}
      />
    )
  }

  return <ConversationsView organizationId={organizationId} />
}

// ── Conversations view (existing logic) ─────────────────────────────────────

function ConversationsView({ organizationId }: { organizationId: string }) {
  const supabase = createClient()

  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [leads, setLeads] = useState<Map<string, Lead>>(new Map())
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'instagram' | 'facebook'>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)

  const chatRef = useRef<HTMLDivElement>(null)

  const fetchData = async () => {
    setLoading(true)
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, lead_id, sender_phone, sender_name, direction, content, channel, is_read, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    const messages = (msgs ?? []) as Message[]
    setAllMessages(messages)

    const leadIds = [...new Set(messages.map(m => m.lead_id).filter(Boolean))] as string[]
    if (leadIds.length > 0) {
      const { data: leadRows } = await supabase
        .from('leads')
        .select('id, contact_name, contact_phone')
        .in('id', leadIds)
      const map = new Map<string, Lead>()
      ;(leadRows ?? []).forEach((l: Lead) => map.set(l.id, l))
      setLeads(map)
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [organizationId])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [selectedKey, allMessages])

  const convKey = (m: Message) => m.lead_id ?? m.sender_phone ?? 'unknown'

  const conversations: Conversation[] = (() => {
    const map = new Map<string, Conversation>()
    ;[...allMessages].reverse().forEach(m => {
      const key = convKey(m)
      const lead = m.lead_id ? leads.get(m.lead_id) : null
      const unread = allMessages.some(x => convKey(x) === key && x.direction === 'inbound' && !x.is_read)
      map.set(key, {
        key,
        lead_id: m.lead_id,
        lead_name: lead?.contact_name ?? m.sender_name ?? m.sender_phone ?? 'Desconocido',
        lead_phone: lead?.contact_phone ?? m.sender_phone ?? null,
        channel: m.channel,
        last_message: m.content,
        last_at: m.created_at,
        unread,
      })
    })
    return [...map.values()].sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime())
  })()

  const filteredConvs = conversations.filter(c => {
    const matchChannel = channelFilter === 'all' || c.channel === channelFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (c.lead_name ?? '').toLowerCase().includes(q) ||
      (c.lead_phone ?? '').includes(q)
    return matchChannel && matchSearch
  })

  const selectedConv = filteredConvs.find(c => c.key === selectedKey) ?? null

  const chatMessages = selectedKey
    ? [...allMessages]
        .filter(m => convKey(m) === selectedKey)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : []

  const markRead = async (key: string) => {
    const ids = allMessages
      .filter(m => convKey(m) === key && m.direction === 'inbound' && !m.is_read)
      .map(m => m.id)
    if (!ids.length) return
    await supabase.from('messages').update({ is_read: true }).in('id', ids)
    setAllMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, is_read: true } : m))
  }

  const selectConversation = (key: string) => {
    setSelectedKey(key)
    setShowChat(true)
    markRead(key)
  }

  const groupedMessages: { separator: string | null; message: Message }[] = []
  let lastSep: string | null = null
  chatMessages.forEach(m => {
    const sep = dateSeparator(m.created_at)
    if (sep !== lastSep) {
      groupedMessages.push({ separator: sep, message: m })
      lastSep = sep
    } else {
      groupedMessages.push({ separator: null, message: m })
    }
  })

  return (
    <div className="flex h-screen bg-white">
      <div className="flex h-full">

        {/* ── LEFT COLUMN ── */}
        <div className={[
          'flex flex-col w-80 border-r border-slate-100 shrink-0',
          showChat ? 'hidden md:flex' : 'flex',
        ].join(' ')}>
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900">Conversaciones</h2>
              <span className="text-xs text-slate-400">{filteredConvs.length}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-1.5 mt-2.5">
              {(['all', 'whatsapp', 'instagram', 'facebook'] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={[
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition',
                    channelFilter === ch
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                  ].join(' ')}
                >
                  {ch === 'all' ? 'Todos' : ch === 'whatsapp' ? 'WhatsApp' : ch === 'instagram' ? 'Instagram' : 'Facebook'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Cargando...</span>
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageCircle className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-sm text-slate-400">No hay conversaciones aún</p>
                <p className="text-xs text-slate-300 mt-1">Las conversaciones aparecerán cuando el agente AI interactúe con tus leads</p>
              </div>
            ) : (
              filteredConvs.map(conv => (
                <button
                  key={conv.key}
                  onClick={() => selectConversation(conv.key)}
                  className={[
                    'w-full flex items-start gap-3 px-4 py-3 border-b border-slate-50 text-left transition hover:bg-slate-50',
                    selectedKey === conv.key ? 'bg-slate-50' : '',
                  ].join(' ')}
                >
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-blue-600">
                      {(conv.lead_name ?? '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium text-slate-900 truncate">{conv.lead_name}</span>
                        {conv.unread && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{relativeTime(conv.last_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {channelBadge(conv.channel)}
                      <p className="text-xs text-slate-500 truncate">{conv.last_message.slice(0, 50)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className={[
          'flex-1 flex flex-col min-w-0',
          showChat ? 'flex' : 'hidden md:flex',
        ].join(' ')}>
          {!selectedConv ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
              <MessageCircle className="h-12 w-12 text-slate-200 mb-4" />
              <p className="text-sm font-medium text-slate-400">Selecciona una conversación</p>
              <p className="text-xs text-slate-300 mt-1">Elige un chat de la lista para ver los mensajes</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowChat(false)}
                    className="md:hidden text-xs text-blue-600 hover:text-blue-700 mr-1"
                  >
                    ←
                  </button>
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-blue-600">
                      {(selectedConv.lead_name ?? '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedConv.lead_name}</p>
                    {selectedConv.lead_phone && (
                      <p className="text-xs text-slate-400">{selectedConv.lead_phone}</p>
                    )}
                  </div>
                </div>
                {selectedConv.lead_id && (
                  <a
                    href={selectedConv.lead_id ? `/crm?lead=${selectedConv.lead_id}` : '/crm'}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Ver en CRM
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-1">
                {groupedMessages.map(({ separator, message }) => (
                  <div key={message.id}>
                    {separator && (
                      <div className="flex items-center justify-center my-4">
                        <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-400">{separator}</span>
                      </div>
                    )}
                    <div className={[
                      'flex mb-2',
                      message.direction === 'outbound' ? 'justify-end' : 'justify-start',
                    ].join(' ')}>
                      <div className={[
                        'max-w-[70%] rounded-2xl px-4 py-2.5',
                        message.direction === 'outbound'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-900 rounded-bl-sm',
                      ].join(' ')}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        <p className={[
                          'text-[10px] mt-1',
                          message.direction === 'outbound' ? 'text-blue-200' : 'text-slate-400',
                        ].join(' ')}>
                          {format(new Date(message.created_at), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="shrink-0 bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center gap-2">
                <Bot className="h-4 w-4 text-slate-400 shrink-0" />
                <p className="text-sm text-slate-500">Las respuestas se envían automáticamente por el agente AI · Los mensajes se retienen por 48 horas</p>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
