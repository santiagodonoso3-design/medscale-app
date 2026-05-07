'use client'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Calendar, MessageCircle, CheckCircle2 } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'

interface Doctor {
  id: string
  name: string
  google_calendar_connected_at: string | null
  google_calendar_id: string | null
}

function IntegrationsContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('google_success') === 'true') {
      setToast({ msg: 'Google Calendar conectado exitosamente', ok: true })
      router.replace('/settings/integrations')
    } else if (searchParams.get('google_error') === 'true') {
      setToast({ msg: 'Error conectando Google Calendar', ok: false })
      router.replace('/settings/integrations')
    }
  }, [searchParams])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    loadDoctors()
  }, [])

  async function loadDoctors() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('users').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return

    const { data } = await supabase
      .from('doctors')
      .select('id, metadata, google_calendar_connected_at, google_calendar_id')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    setDoctors((data ?? []).map((d: any) => ({
      id: d.id,
      name: d.metadata?.name ?? 'Médico',
      google_calendar_connected_at: d.google_calendar_connected_at,
      google_calendar_id: d.google_calendar_id,
    })))
    setLoading(false)
  }

  async function handleDisconnect(doctorId: string) {
    setDisconnecting(doctorId)
    await fetch('/api/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctor_id: doctorId }),
    })
    await loadDoctors()
    setDisconnecting(null)
    setToast({ msg: 'Google Calendar desconectado', ok: true })
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Integraciones</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Conecta MedScale con tus herramientas de trabajo
        </p>
      </div>

      {/* CALENDARIOS */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Calendarios
          </h3>
        </div>
        <div className="space-y-3">
          {/* Google Calendar */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  <svg viewBox="0 0 48 48" className="w-7 h-7">
                    <path fill="#4285F4" d="M44 24c0-1.3-.1-2.5-.3-3.7H24v7h11.3c-.5 2.6-2 4.8-4.2 6.3v5.2h6.8C41.5 35.4 44 30.1 44 24z"/>
                    <path fill="#34A853" d="M24 44c5.6 0 10.3-1.9 13.7-5.1l-6.8-5.2c-1.9 1.3-4.3 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.6v5.4C9 39.4 16 44 24 44z"/>
                    <path fill="#FBBC05" d="M12.6 27.3c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.4H5.6C4.1 17 3 20.4 3 24s1.1 7 3.6 10.1l7-5.8z"/>
                    <path fill="#EA4335" d="M24 10.6c3 0 5.7 1 7.8 3l5.8-5.8C34.3 4.5 29.6 2 24 2 16 2 9 6.6 5.6 13.9l7 5.4C14.2 14.2 18.7 10.6 24 10.6z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Google Calendar</p>
                  <p className="text-xs text-slate-500">
                    Sincroniza citas automáticamente con el calendario de cada médico
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Activo
              </span>
            </div>

            <div className="px-5 py-4">
              {loading ? (
                <div className="flex items-center gap-2 text-slate-400 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Cargando médicos...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    Médicos
                  </p>
                  {doctors.map(doctor => (
                    <div key={doctor.id}
                      className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          doctor.google_calendar_connected_at ? 'bg-emerald-500' : 'bg-slate-200'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{doctor.name}</p>
                          {doctor.google_calendar_connected_at && (
                            <p className="text-xs text-slate-400">
                              {doctor.google_calendar_id} · conectado {new Date(doctor.google_calendar_connected_at).toLocaleDateString('es-CO')}
                            </p>
                          )}
                        </div>
                      </div>
                      {doctor.google_calendar_connected_at ? (
                        <button
                          onClick={() => handleDisconnect(doctor.id)}
                          disabled={disconnecting === doctor.id}
                          className="text-xs font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-50"
                        >
                          {disconnecting === doctor.id ? 'Desconectando...' : 'Desconectar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => { window.location.href = `/api/google/auth?doctor_id=${doctor.id}` }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <svg viewBox="0 0 48 48" className="w-3.5 h-3.5">
                            <path fill="#4285F4" d="M44 24c0-1.3-.1-2.5-.3-3.7H24v7h11.3c-.5 2.6-2 4.8-4.2 6.3v5.2h6.8C41.5 35.4 44 30.1 44 24z"/>
                            <path fill="#34A853" d="M24 44c5.6 0 10.3-1.9 13.7-5.1l-6.8-5.2c-1.9 1.3-4.3 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.6v5.4C9 39.4 16 44 24 44z"/>
                            <path fill="#FBBC05" d="M12.6 27.3c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.4H5.6C4.1 17 3 20.4 3 24s1.1 7 3.6 10.1l7-5.8z"/>
                            <path fill="#EA4335" d="M24 10.6c3 0 5.7 1 7.8 3l5.8-5.8C34.3 4.5 29.6 2 24 2 16 2 9 6.6 5.6 13.9l7 5.4C14.2 14.2 18.7 10.6 24 10.6z"/>
                          </svg>
                          Conectar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Outlook — próximamente */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 flex items-center justify-between opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">O</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Outlook Calendar</p>
                <p className="text-xs text-slate-400">Microsoft 365 y Outlook personal</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
              Próximamente
            </span>
          </div>
        </div>
      </section>

      {/* MENSAJERÍA */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Mensajería
          </h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 flex items-center justify-between opacity-60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">WhatsApp</p>
              <p className="text-xs text-slate-400">Meta Cloud API — mensajes automáticos</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
            Próximamente
          </span>
        </div>
      </section>

      {/* REDES SOCIALES */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Redes Sociales
          </h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 flex items-center justify-between opacity-60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Instagram</p>
              <p className="text-xs text-slate-400">Captura leads desde mensajes directos</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
            Próximamente
          </span>
        </div>
      </section>

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-2xl px-5 py-3 text-sm text-white shadow-lg ${
          toast.ok ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsContent />
    </Suspense>
  )
}
