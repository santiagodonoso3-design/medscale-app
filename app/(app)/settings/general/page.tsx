'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getOrgSettings, uploadOrgLogo } from '@/app/actions/settings'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const B = {
  primary: '#215F73', fg: '#0D2B3E', muted: '#4A6B7A',
  bg: '#EBF0F6', border: '#C8D8E4', secondary: '#F3F7FA',
}

export default function GeneralPage() {
  const [orgId,        setOrgId]        = useState<string | null>(null)
  const [name,         setName]         = useState('')
  const [primaryColor, setPrimaryColor] = useState('#215F73')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const data = await getOrgSettings()
      if (!data) return
      setOrgId(data.id)
      setName(data.name ?? '')
      setPrimaryColor(data.primary_color ?? '#215F73')
      setLogoUrl(data.logo_url ?? null)
      setLoading(false)
    }
    load()
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    const { error } = await supabase
      .from('organizations')
      .update({ name, primary_color: primaryColor, logo_url: logoUrl })
      .eq('id', orgId)
    setSaving(false)
    if (error) showToast('Error al guardar')
    else showToast('Cambios guardados')
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !orgId) return
    setUploading(true)

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const url = await uploadOrgLogo(orgId, base64, file.name, file.type)
      setUploading(false)
      if (!url) { showToast('Error subiendo logo'); return }
      setLogoUrl(url)
      showToast('Logo subido correctamente')
    }
    reader.readAsDataURL(file)
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2'
  const inputStyle = { border: `1px solid ${B.border}`, background: '#fff', color: B.fg }

  if (loading) return <div className="text-sm" style={{ color: B.muted }}>Cargando...</div>

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: B.fg }}>General</h2>
        <p className="text-sm mt-0.5" style={{ color: B.muted }}>Información y apariencia de tu clínica</p>
      </div>

      {/* Nombre */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: B.muted }}>
          Nombre de la clínica
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className={inputCls}
          style={inputStyle}
          placeholder="Nombre de tu clínica"
        />
      </div>

      {/* Color primario */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: B.muted }}>
          Color primario
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            className="h-10 w-14 rounded-xl cursor-pointer border"
            style={{ borderColor: B.border }}
          />
          <input
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            className={inputCls + ' flex-1'}
            style={inputStyle}
            placeholder="#215F73"
            maxLength={7}
          />
          <div className="h-10 w-10 rounded-xl shrink-0" style={{ background: primaryColor }} />
        </div>
        <p className="text-xs mt-1.5" style={{ color: B.muted }}>
          Se aplica en el formulario de agendamiento público
        </p>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: B.muted }}>
          Logo
        </label>
        {logoUrl && (
          <div className="mb-3 p-3 rounded-xl flex items-center gap-3" style={{ background: B.secondary, border: `1px solid ${B.border}` }}>
            <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
            <button
              onClick={() => setLogoUrl(null)}
              className="text-xs text-red-500 hover:underline ml-auto"
            >
              Eliminar
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition"
          style={{ border: `1px solid ${B.border}`, background: B.secondary, color: B.fg }}
        >
          {uploading ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
        </button>
        <p className="text-xs mt-1.5" style={{ color: B.muted }}>PNG o SVG con fondo transparente. Recomendado: 200×80px</p>
      </div>

      {/* Guardar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition"
        style={{ background: B.primary, opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-2xl text-sm font-medium text-white shadow-lg"
          style={{ background: B.primary }}>
          {toast}
        </div>
      )}
    </div>
  )
}
