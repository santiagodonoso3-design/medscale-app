/**
 * Base URL de la aplicación. Prioridad:
 * 1. window.location.origin (si estamos en browser)
 * 2. new URL(request.url).origin (si nos pasan un request)
 * 3. process.env.NEXT_PUBLIC_APP_URL (si está seteada, útil en cron/server actions)
 * 4. Fallback hardcoded a producción
 *
 * Nunca devuelve trailing slash.
 * Corre en client y server: NO importar 'server-only' aquí.
 */
const PRODUCTION_URL = 'https://app.medscale.app'

export function getAppUrl(request?: Request): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  if (request) {
    try {
      return new URL(request.url).origin
    } catch {
      // request.url malformado, cae al siguiente
    }
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  return PRODUCTION_URL
}
