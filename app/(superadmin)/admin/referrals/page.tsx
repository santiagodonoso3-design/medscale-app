'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, X, Save, Gift, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DatePicker } from '@/components/ui/date-picker'

interface ReferralCode {
  id: string
  code: string
  referrer_name: string
  referrer_email: string | null
  referrer_phone: string | null
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  discount_duration_months: number | null
  commission_type: string | null
  commission_value: number | null
  commission_duration_months: number | null
  max_uses: number | null
  times_used: number
  is_active: boolean
  expires_at: string | null
  created_at: string
}

interface ReferralUse {
  id: string
  referral_code_id: string
  organization_id: string
  discount_applied: number | null
  status: 'active' | 'expired' | 'cancelled'
  applied_at: string
  organizations: { name: string; slug: string } | null
}

const EMPTY_FORM = {
  code: '',
  referrer_name: '',
  referrer_email: '',
  referrer_phone: '',
  discount_type: 'percentage' as 'percentage' | 'fixed_amount',
  discount_value: '',
  discount_duration_months: '',
  commission_type: '',
  commission_value: '',
  commission_duration_months: '',
  max_uses: '',
  expires_at: '',
  is_active: true,
}

function discountLabel(c: ReferralCode) {
  if (c.discount_type === 'percentage') return `${c.discount_value}%`
  return `$${c.discount_value.toLocaleString('es-CO')}`
}

function commissionLabel(c: ReferralCode) {
  if (!c.commission_value) return '—'
  return `${c.commission_value}${c.commission_type === 'percentage' ? '%' : ''}`
}

const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-slate-400'

export default function ReferralsPage() {
  const [codes, setCodes]       = useState<ReferralCode[]>([])
  const [uses, setUses]         = useState<ReferralUse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]   = useState<ReferralCode | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/referrals')
    if (res.ok) {
      const data = await res.json()
      setCodes(data.codes ?? [])
      setUses(data.uses ?? [])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(c: ReferralCode) {
    setEditing(c)
    setForm({
      code:                       c.code,
      referrer_name:              c.referrer_name,
      referrer_email:             c.referrer_email ?? '',
      referrer_phone:             c.referrer_phone ?? '',
      discount_type:              c.discount_type,
      discount_value:             String(c.discount_value),
      discount_duration_months:   c.discount_duration_months != null ? String(c.discount_duration_months) : '',
      commission_type:            c.commission_type ?? '',
      commission_value:           c.commission_value != null ? String(c.commission_value) : '',
      commission_duration_months: c.commission_duration_months != null ? String(c.commission_duration_months) : '',
      max_uses:                   c.max_uses != null ? String(c.max_uses) : '',
      expires_at:                 c.expires_at ? c.expires_at.slice(0, 10) : '',
      is_active:                  c.is_active,
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.code.trim())          { setFormError('El código es obligatorio'); return }
    if (!form.referrer_name.trim()) { setFormError('El nombre del referidor es obligatorio'); return }
    if (!form.discount_value || isNaN(Number(form.discount_value))) {
      setFormError('El valor de descuento es obligatorio'); return
    }

    setSaving(true)
    setFormError(null)

    const payload = {
      code:                       form.code.toUpperCase().trim(),
      referrer_name:              form.referrer_name.trim(),
      referrer_email:             form.referrer_email || null,
      referrer_phone:             form.referrer_phone || null,
      discount_type:              form.discount_type,
      discount_value:             Number(form.discount_value),
      discount_duration_months:   form.discount_duration_months ? Number(form.discount_duration_months) : null,
      commission_type:            form.commission_type || null,
      commission_value:           form.commission_value ? Number(form.commission_value) : null,
      commission_duration_months: form.commission_duration_months ? Number(form.commission_duration_months) : null,
      max_uses:                   form.max_uses ? Number(form.max_uses) : null,
      is_active:                  form.is_active,
      expires_at:                 form.expires_at || null,
    }

    const res = await fetch('/api/referrals', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    })

    const data = await res.json()
    if (!res.ok) {
      setFormError(data.error ?? 'Error guardando')
      setSaving(false)
      return
    }

    await loadData()
    setSaving(false)
    setModalOpen(false)
  }

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Referidos</h1>
          <p className="text-slate-600">Códigos de referido y seguimiento de usos</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nuevo código
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Codes table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Códigos ({codes.length})</h2>
            </div>
            {codes.length === 0 ? (
              <div className="p-12 text-center">
                <Gift className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Sin códigos aún. Crea el primero.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Referidor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Descuento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Comisión</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Usos</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Creado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {codes.map(c => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => openEdit(c)}
                      >
                        <td className="px-6 py-3.5">
                          <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700">{c.code}</code>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-slate-900">{c.referrer_name}</p>
                          {c.referrer_email && <p className="text-xs text-slate-400">{c.referrer_email}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-emerald-700">
                          {discountLabel(c)}
                          {c.discount_duration_months && (
                            <span className="text-xs text-slate-400 font-normal"> · {c.discount_duration_months}m</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">{commissionLabel(c)}</td>
                        <td className="px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                          {c.times_used}{c.max_uses != null ? `/${c.max_uses}` : ''}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {c.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500">
                          {format(new Date(c.created_at), 'dd MMM yyyy', { locale: es })}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(c) }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent uses */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Usos recientes</h2>
            </div>
            {uses.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 text-sm">Sin usos registrados aún.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Organización</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha de uso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {uses.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="text-sm font-medium text-slate-900">{u.organizations?.name ?? u.organization_id}</p>
                          {u.organizations?.slug && <p className="text-xs text-slate-400">{u.organizations.slug}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700">
                            {codes.find(c => c.id === u.referral_code_id)?.code ?? u.referral_code_id.slice(0, 8) + '…'}
                          </code>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.status === 'active'    ? 'bg-emerald-100 text-emerald-700' :
                            u.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {u.status === 'active' ? 'Activo' : u.status === 'cancelled' ? 'Cancelado' : 'Expirado'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500">
                          {format(new Date(u.applied_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? 'Editar código' : 'Nuevo código de referido'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Código */}
              <div>
                <label className={labelCls}>Código *</label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="DRGARCIA20"
                  className={`${inputCls} font-mono`}
                />
              </div>

              {/* Referidor */}
              <div>
                <label className={labelCls}>Nombre del referidor *</label>
                <input
                  value={form.referrer_name}
                  onChange={e => setForm(f => ({ ...f, referrer_name: e.target.value }))}
                  placeholder="Dr. Juan García"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={form.referrer_email}
                    onChange={e => setForm(f => ({ ...f, referrer_email: e.target.value }))}
                    placeholder="dr@email.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input
                    value={form.referrer_phone}
                    onChange={e => setForm(f => ({ ...f, referrer_phone: e.target.value }))}
                    placeholder="+57 300 000 0000"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Descuento */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Tipo descuento *</label>
                  <select
                    value={form.discount_type}
                    onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'percentage' | 'fixed_amount' }))}
                    className={inputCls}
                  >
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed_amount">Monto fijo ($)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Valor *</label>
                  <input
                    type="number"
                    min={0}
                    value={form.discount_value}
                    onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                    placeholder={form.discount_type === 'percentage' ? '20' : '50000'}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Meses</label>
                  <input
                    type="number"
                    min={1}
                    value={form.discount_duration_months}
                    onChange={e => setForm(f => ({ ...f, discount_duration_months: e.target.value }))}
                    placeholder="∞"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Comisión */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                <p className={labelCls}>Comisión al referidor</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Tipo</label>
                    <input
                      value={form.commission_type}
                      onChange={e => setForm(f => ({ ...f, commission_type: e.target.value }))}
                      placeholder="percentage"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Valor</label>
                    <input
                      type="number"
                      min={0}
                      value={form.commission_value}
                      onChange={e => setForm(f => ({ ...f, commission_value: e.target.value }))}
                      placeholder="10"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Meses</label>
                    <input
                      type="number"
                      min={1}
                      value={form.commission_duration_months}
                      onChange={e => setForm(f => ({ ...f, commission_duration_months: e.target.value }))}
                      placeholder="∞"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Límites */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Máximo usos</label>
                  <input
                    type="number"
                    min={1}
                    value={form.max_uses}
                    onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                    placeholder="Ilimitado"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fecha expiración</label>
                  <DatePicker
                    value={form.expires_at}
                    onChange={(d) => setForm(f => ({ ...f, expires_at: d }))}
                    placeholder="Sin expiración"
                  />
                </div>
              </div>

              {/* Estado (solo edición) */}
              {editing && (
                <div>
                  <label className={labelCls}>Estado</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`mt-2 flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      form.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </div>
                    {form.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              )}

              {formError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editing ? 'Guardar cambios' : 'Crear código'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
