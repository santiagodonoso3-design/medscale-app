// Captura y saneamiento de parametros de atribucion (UTM + click IDs).
// Fuente unica de verdad: el cliente captura, el servidor sanea.
// El body del cliente NUNCA se confia: solo pasan llaves de la whitelist.

export const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'referrer',
] as const

export type AttributionKey = typeof ATTRIBUTION_KEYS[number]
export type Attribution = Partial<Record<AttributionKey, string>>

const MAX_LEN = 120

/** Cliente: lee query params + referrer. Devuelve {} si no hay nada. */
export function captureAttribution(search: string, referrer?: string): Attribution {
  const out: Attribution = {}
  try {
    const params = new URLSearchParams(search)
    for (const key of ATTRIBUTION_KEYS) {
      if (key === 'referrer') continue
      const v = params.get(key)
      if (v && v.trim()) out[key] = v.trim().slice(0, MAX_LEN)
    }
  } catch { /* URLSearchParams invalido: se ignora */ }
  if (referrer && referrer.trim()) out.referrer = referrer.trim().slice(0, MAX_LEN)
  return out
}

/** Servidor: whitelist estricta + tope de longitud. null si queda vacio. */
export function sanitizeAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const src = input as Record<string, unknown>
  const out: Attribution = {}
  for (const key of ATTRIBUTION_KEYS) {
    const v = src[key]
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, MAX_LEN)
  }
  return Object.keys(out).length > 0 ? out : null
}
