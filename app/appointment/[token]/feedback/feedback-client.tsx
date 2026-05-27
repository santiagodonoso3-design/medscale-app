'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

const REASONS = [
  'No pude asistir por un imprevisto',
  'Se me olvidó la cita',
  'Cambio de planes',
  'Problema de salud',
  'Otra razón',
]

interface Props {
  token: string
  orgName: string
  orgSlug: string
  appointmentExists: boolean
  alreadyAnswered: boolean
}

export default function FeedbackClient({ token, orgName, orgSlug, appointmentExists, alreadyAnswered }: Props) {
  const [selected,  setSelected]  = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const bookingUrl = `/book/${orgSlug}`

  // ── Already done or no appointment ──────────────────────────────────────────
  if (!appointmentExists || alreadyAnswered || submitted) {
    return (
      <div className="min-h-screen bg-[#EBF0F6] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-10 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="rounded-full bg-emerald-100 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-[#0D2B3E] mb-2">
            {submitted ? '¡Gracias por tu respuesta!' : 'Gracias por tu respuesta'}
          </h1>
          <p className="text-sm text-[#4A6B7A] mb-8">
            {submitted
              ? 'Tu feedback nos ayuda a mejorar el servicio.'
              : 'Ya registramos tu respuesta anteriormente.'}
          </p>
          {orgSlug && (
            <a
              href={bookingUrl}
              className="inline-block bg-[#215F73] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a4d5e] transition"
            >
              Reagendar cita
            </a>
          )}
        </div>
      </div>
    )
  }

  // ── Submit handler ───────────────────────────────────────────────────────────
  async function handleSubmit() {
    const reason = selected === 'Otra razón' ? (otherText.trim() || 'Otra razón') : selected
    if (!reason) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/appointment/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, reason }),
      })
      if (!res.ok) { setError('Ocurrió un error. Intenta de nuevo.'); setSaving(false); return }
      setSubmitted(true)
    } catch { setError('Ocurrió un error. Intenta de nuevo.'); setSaving(false) }
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EBF0F6] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo-dark.png" alt="MedScale AI" className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-bold text-[#0D2B3E]">¿No pudiste asistir a tu cita?</h1>
          <p className="text-sm text-[#4A6B7A] mt-2">
            Ayúdanos a mejorar seleccionando la razón:
          </p>
        </div>

        {/* Reason buttons */}
        <div className="space-y-3">
          {REASONS.map(reason => (
            <button
              key={reason}
              onClick={() => setSelected(reason)}
              className={`w-full rounded-xl border py-3 px-4 text-left text-sm font-medium transition ${
                selected === reason
                  ? 'border-[#215F73] bg-[#215F73]/5 text-[#215F73]'
                  : 'border-[#C8D8E4] text-[#0D2B3E] hover:bg-slate-50'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        {/* "Otra razón" textarea */}
        {selected === 'Otra razón' && (
          <textarea
            value={otherText}
            onChange={e => setOtherText(e.target.value)}
            placeholder="Cuéntanos qué pasó..."
            rows={3}
            className="mt-3 w-full rounded-xl border border-[#C8D8E4] bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#215F73] resize-none"
          />
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selected || saving}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-[#215F73] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#1a4d5e] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Enviar respuesta
        </button>

        {/* Rebook link */}
        {orgSlug && (
          <div className="mt-4 text-center">
            <a href={bookingUrl} className="text-sm text-[#215F73] font-medium hover:underline">
              Reagendar cita →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
