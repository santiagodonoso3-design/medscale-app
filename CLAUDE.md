# MedScale App — Estado del proyecto (13 Mayo 2026)

---

## 🚨 REGLAS DE ARQUITECTURA — LEER ANTES DE CUALQUIER CAMBIO

### Filosofía de estas reglas

Estas reglas no son inmutables. Se pueden y deben evolucionar cuando el proyecto lo requiera. Pero cualquier cambio a una regla debe cumplir esto:

- **Visión holística:** ¿Cómo impacta este cambio al sistema completo?
  No se cambia una regla para resolver un bug puntual — se busca la causa raíz.
- **Sostenibilidad:** ¿Este cambio nos hace más sólidos a 6 meses o solo resuelve lo de hoy? Si es un parche, no es un cambio de regla.
- **Consistencia:** Si cambias un patrón, se migra en **TODOS** los archivos que lo usen. No se deja código viejo conviviendo con código nuevo.
- **Validación:** Antes de cambiar una regla, analizar cuántos archivos afecta y qué puede romperse. Nunca cambiar a ciegas.

Si durante el desarrollo encuentras que una regla no aplica o hay un camino mejor: no la ignores ni la rompas silenciosamente. Proponla como cambio con argumentos (por qué es mejor, qué impacto tiene, cómo se migra). Si tiene sentido, se actualiza la regla Y se migra todo el codebase. Si no tiene sentido, se sigue la regla actual.

### Fuente de verdad para identity

```
┌─────────────┐     ┌──────────────────────┐     ┌───────────────┐
│ auth.users  │────▶│ organization_members  │────▶│ organizations │
│ (auth)      │     │ (org + role + doctor) │     │ (tenant data) │
└─────────────┘     └──────────────────────┘     └───────────────┘
```

- `auth.users` → autenticación (email, password, OAuth)
- `organization_members` → relación usuario ↔ organización + rol
- `organizations` → datos del tenant

**NUNCA usar la tabla `public.users` para obtener `organization_id` o `role`.**
La tabla `public.users` es legacy y será eliminada en el futuro.

### Patrones obligatorios

**1. Obtener sesión en server components:**
```typescript
import { getSession } from '@/lib/auth/session'

const session = await getSession()
if (!session) redirect('/login')
// session.user, session.orgId, session.role, session.doctorId
```

**2. Obtener orgId en server actions / API routes (cuando no hay getSession):**
```typescript
import { getOrgIdFromUser } from '@/lib/get-org-id'

const orgId = await getOrgIdFromUser(user.id)
```

**3. Queries en client components (browser):**
```typescript
// Obtener orgId desde organization_members
const { data: member } = await supabase
  .from('organization_members')
  .select('organization_id')
  .eq('user_id', user.id)
  .single()
```

**4. Service client para operaciones admin:**
```typescript
import { createServiceClient } from '@/lib/supabase/server'
const admin = createServiceClient() // síncrono, NO async
```

**5. Client de auth para server components:**
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient() // async, usa cookies
```

### Patrones PROHIBIDOS

```typescript
// ❌ NUNCA — tabla legacy
.from('users').select('organization_id')

// ❌ NUNCA — await en createServiceClient
const admin = await createServiceClient()

// ❌ NUNCA — queries a DB en middleware
// El middleware solo verifica si hay sesión, nada más

// ❌ NUNCA — queries sin filtro de organization_id
.from('doctors').select('*') // trae TODOS los doctores de TODOS los tenants

// ❌ NUNCA — createServerClient con service role key
// createServerClient es para cookies/auth, NO para service role
import { createServerClient } from '@supabase/ssr'
createServerClient(url, SERVICE_ROLE_KEY) // ← INCORRECTO

// ❌ NUNCA — acceder a params sin await en Next.js 15
const slug = params['org-slug'] // ← crash
// ✅ CORRECTO:
const resolvedParams = await params
const slug = resolvedParams['org-slug']
```

### RLS (Row Level Security)

- Todas las policies usan la función `get_user_org_id()`
- `get_user_org_id()` consulta `organization_members` (NO `public.users`)
- Si creas una tabla nueva con `organization_id`, crear policy:

```sql
CREATE POLICY "org_access" ON nueva_tabla
  FOR ALL USING (organization_id = get_user_org_id());
```

### Multi-tenancy — regla de oro

Toda query a datos de negocio **DEBE** incluir `.eq('organization_id', orgId)`

Tablas que requieren filtro: `appointments`, `leads`, `doctors`, `appointment_types`,
`messages`, `schedules` (via `doctor_id`), `appointment_type_notifications`,
`appointment_form_fields`.

### Middleware

El middleware es **LIGERO** (~48 líneas). Solo hace:
1. Refrescar cookies de Supabase
2. Sin sesión + ruta no pública → redirect `/login`
3. Con sesión en `/login` o `/register` → redirect `/dashboard`

La protección por roles la manejan `layout.tsx` y cada página vía `getSession()`.
**NUNCA** agregar queries a DB en el middleware.

### Estructura de archivos

```
lib/
  auth/session.ts        → getSession() — USAR SIEMPRE en server components
  get-org-id.ts          → getOrgIdFromUser() — para actions/APIs
  supabase/server.ts     → createClient() + createServiceClient()
  supabase/client.ts     → cliente browser
  email/resend.ts        → envío de emails
  email/templates.ts     → templates HTML
  google/calendar.ts     → integración Google Calendar

app/
  (app)/                 → rutas protegidas del dashboard
  (auth)/                → login, register, reset-password
  (superadmin)/          → panel admin (usa public.users, OK por ahora)
  onboarding/            → wizard post-registro
  book/                  → agendamiento público
  api/                   → API routes
```

---

## ✅ Completado

### Auth y Deploy
- ✅ Login en producción (Supabase Auth)
- ✅ Sign in with Google — OAuth 2.0 con vinculación de cuentas por email
- ✅ /auth/callback — maneja redirect de Google OAuth
- ✅ Variables de entorno en Vercel
- ✅ Middleware simplificado (solo auth, sin queries de rol)
- ✅ "Olvidé mi contraseña" — flujo completo con email desde passwordreset@medscale.app
- ✅ /reset-password — maneja invite + recovery flows (Suspense boundary)
- ✅ SMTP configurado en Supabase con Resend (bypasea rate limit)
- ✅ Email template reset password con logo MedScale y diseño branded
- ✅ Allow manual linking habilitado en Supabase (vincula Google a cuenta existente)
- ✅ Autodeploy GitHub→Vercel configurado

### Arquitectura (13 Mayo 2026)
- ✅ `getSession()` helper centralizado en `lib/auth/session.ts`
- ✅ Migración `from('users')` → `getOrgIdFromUser`/`getSession` en 14+ archivos
- ✅ `createServiceClient()` usa `@supabase/supabase-js` (service role real, bypasea RLS)
- ✅ `get_user_org_id()` SQL function apunta a `organization_members`
- ✅ Todas las RLS policies migradas a `get_user_org_id()`
- ✅ Foreign key `doctors.user_id` → `auth.users` (no `public.users`)
- ✅ Middleware simplificado: 0 queries a DB, solo verifica sesión
- ✅ Layout usa `getSession()`
- ✅ Dashboard filtra por `organization_id`
- ✅ Doctors page filtra por `organization_id`
- ✅ Limpieza: eliminados `guards.ts`, `layout/header.tsx`, `layout/sidebar.tsx`, `api/dev/`, `console.logs`

### Sistema de Roles y Equipo
- ✅ Tabla `organization_members`: id, organization_id, user_id, role, doctor_id, invited_by
- ✅ Roles: owner | staff | doctor (superadmin invisible en UI)
- ✅ Sidebar filtra items según rol del usuario
- ✅ Badge de rol visible en sidebar (Admin / Colaborador / Médico)
- ✅ /team: panel de gestión de equipo
- ✅ /api/team/invite: invita via Supabase Auth + agrega a organization_members + crea doctor
- ✅ Protección de rutas por rol en `layout.tsx` y páginas (NO en middleware)
- ✅ Permisos por módulo según rol:
  | Módulo | Owner | Staff | Doctor |
  |---|---|---|---|
  | Dashboard | ✅✅ | ✅❌ | ❌❌ |
  | CRM | ✅✅ | ✅✅ | ❌❌ |
  | Agenda | ✅✅ | ✅✅ | ✅ solo suyas |
  | Doctores | ✅✅ | ✅ ver+disponibilidad | ✅ solo su perfil |
  | Conversaciones | ✅✅ | ✅✅ | ❌❌ |
  | Equipo | ✅✅ | ❌❌ | ❌❌ |
  | Configuración | ✅✅ | ❌❌ | Solo Integraciones |

### Onboarding Wizard (13 Mayo 2026)
- ✅ Wizard 4 pasos: Datos clínica → Primer médico → Disponibilidad → Link listo
- ✅ Cada paso guarda en DB al avanzar (no al final)
- ✅ Flag `onboarding_completed` en organizations
- ✅ Dashboard redirige a /onboarding si `onboarding_completed = false`
- ✅ Paso 4 crea appointment_type "Consulta general" automáticamente
- ✅ Teléfono obligatorio en onboarding paso 1
- ✅ Teléfono removido de /register (solo en onboarding)

### Agendamiento público /book/[org-slug]
- ✅ Wizard completo con round-robin, modalidad, médico, calendario, formulario
- ✅ max_notice_days, buffer_before_min, buffer_after_min aplicados
- ✅ Slots ocupados bloqueados (getBookedSlots retorna {start, end}[] en Bogotá)
- ✅ Timezone fix: scheduledAt usa -05:00 (Bogotá)

### Agenda /scheduling/calendar
- ✅ Vista dual: Calendario mensual / Lista (Próximas + Pasadas)
- ✅ Navegar a meses anteriores habilitado
- ✅ Nueva cita manual: flujo 2 pasos
- ✅ Rol doctor: ve solo sus citas, sin dropdown de médicos

### Módulo Doctores /doctors
- ✅ Filtrado por organization_id
- ✅ ⚠️ Sin disponibilidad + link "Configurar →" cuando días = —
- ✅ Rol doctor: solo su perfil, sin Nuevo médico ni Desactivar
- ✅ Disponibilidad /doctors/availability: estilo Cal.com

### CRM /crm
- ✅ Pipeline completo con 6 estados
- ✅ Vista Kanban con drag & drop
- ✅ Modal: citas vinculadas, comentarios, agendamiento interno
- ✅ Estado: dot color + keyword (max 15 chars)
- ✅ Fuente: texto compacto sin dot
- ✅ Orden columnas: Nombre, Cédula, Teléfono, Email, Estado, Fuente, Citas, Creado

### Dashboard /dashboard
- ✅ Funnel + tendencia mensual + agendamiento semanal + por médico
- ✅ Filtrado por organization_id (seguridad multi-tenant)

### Settings /settings
- ✅ General, Sedes, Tipos de cita, Notificaciones (global), Integraciones
- ✅ Settings layout filtra tabs según rol (doctor solo ve Integraciones)

### Google Calendar Integration
- ✅ OAuth 2.0 completo por médico desde /settings/integrations
- ✅ Evento creado con hora Bogotá correcta + invitación al paciente
- ✅ Evento eliminado al cancelar cita
- ✅ Auto-refresh de access_token
- ✅ Rol doctor: ve solo su propio calendario

### Data Ferttes
- ✅ 291 leads + 234 citas históricas cargadas
- ✅ doctor_assignment_type correcto

### Email y notificaciones
- ✅ Resend: citas@medscale.app + passwordreset@medscale.app
- ✅ Confirmación, cancelación, reagendamiento, notificación clínica
- ✅ Cron recordatorios: "0 9 * * *"

### Conversaciones /conversations
- ✅ Tabla messages con RLS (organization_id, lead_id, channel, direction, content)
- ✅ API /api/conversations/webhook — recibe mensajes desde n8n
- ✅ UI estilo WhatsApp: lista agrupada por lead + chat con burbujas
- ✅ Filtros por canal, búsqueda, marca leídos
- ✅ n8n configurado: nodo Webhook Medscale APP en flujos WA, IG, FB

### Registro /register
- ✅ Página /register con wizard 2 pasos: elegir plan → formulario (sin teléfono)
- ✅ API /api/register/complete: crea organización + organization_members con rol owner
- ✅ Redirige a /onboarding después del registro
- ⚠️ Google OAuth en registro NO crea organización — solo funciona con email+password

### UX Improvements
- ✅ Sidebar sticky + colapsable con tooltips
- ✅ CRM estilo Airtable: compacto, edge-to-edge
- ✅ Agenda y Conversaciones edge-to-edge
- ✅ Padding individual por página
- ✅ `app/page.tsx` redirige a /login (no muestra boilerplate)

---

## 🔴 PRIORIDAD 1 — MVP Autoservicio
- [ ] Rediseño profesional página /register (2 columnas, pitch + plans)
- [ ] Logo upload desde /settings/general + onboarding
- [ ] Stripe billing con trial 14 días

## 🟡 PRIORIDAD 2
- [ ] Tour opcional post-onboarding (tooltips en dashboard)
- [ ] Verificar buffer_before/after_min con citas reales
- [ ] Página /account o /settings/profile
- [ ] Probar webhook n8n con mensaje real de WhatsApp/IG/FB
- [ ] Estandarizar respuestas API (lib/api/response.ts)
- [ ] Responsive móvil en /book/[org-slug], /login, /register, /onboarding

## 🟢 PRIORIDAD 3 — Superadmin
- [ ] Dashboard superadmin filtrable por cliente
- [ ] CRUD organizaciones desde /admin
- [ ] Gestión usuarios por organización

## 🔵 Fase 2
- [ ] Google Calendar bidireccional
- [ ] WhatsApp via Meta Cloud API
- [ ] Módulo historia clínica
- [ ] Motor de automatizaciones
- [ ] Reportes y analítica avanzada
- [ ] Eliminar tabla `public.users` completamente

---

## 🏗️ Decisiones Técnicas

### Arquitectura
- **Patrón:** Monolito modular (NO microservicios)
- **Frontend:** Next.js 15 con App Router
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel (autodeploy desde GitHub, branch main)
- **Auth:** `getSession()` centralizado, middleware ligero
- **Multi-tenant:** `organization_id` en toda query de negocio

### ⚠️ Reglas críticas de código

**Next.js 15 — params es Promise:**
```typescript
const resolvedParams = await params
const slug = resolvedParams['org-slug']
```

**schedules no tiene organization_id — filtrar por doctor_id**

**appointments NO tiene appointment_type_id — no incluir en selects**

**`createServiceClient()` es SÍNCRONO — no usar await**

**contact_email de organizations NO viene del join — query separado**

**File objects no se serializan en server actions — usar base64 con FileReader**

**Upload a Storage siempre con service role**

**await en resend.emails.send() — sin await Vercel cierra la función**

**Cron plan Hobby:** máximo 1 vez/día, schedule "0 9 * * *"

**PowerShell con corchetes en rutas — usar -LiteralPath:**
```powershell
Get-Content -LiteralPath "app\book\[org-slug]\page.tsx"
```

**Tabla messages — channel CHECK constraint: `'whatsapp' | 'instagram' | 'facebook' | 'web'`**

**WEBHOOK_SECRET en Vercel — usar en header `x-webhook-secret`**

**Sidebar colapsable — estado en localStorage key `"sidebar-collapsed"`**

**Siempre dar código completo listo para copiar — nunca pedir ajustes manuales**

**No sugerir esperar si hay solución inmediata disponible**

**ANTES de pushear cambios al sidebar o layout:** correr `npx next build` Y `npx next start` para verificar que no crashea en runtime

### Roles — Protección
- Protección por rol en `layout.tsx` y páginas vía `getSession()`
- Doctor permitido: /scheduling, /doctors, /settings/integrations
- Staff bloqueado: /team, /settings/*, /admin
- Doctor en /dashboard → redirect a /scheduling/calendar
- **NO hay verificación de roles en middleware**

### Roles — DB
- Tabla: `organization_members` (organization_id, user_id, role, doctor_id)
- roles: `'owner' | 'staff' | 'doctor'`
- Leer rol: `getSession().role`
- `doctors.user_id` referencia `auth.users(id)`, NO `public.users`

### Google Calendar
- Tokens en `doctors.google_calendar_token` (JSONB)
- Auto-refresh cuando `expiry_date - 60000 < Date.now()`
- scheduledAt debe usar -05:00 (Bogotá), no Z (UTC)
- sendUpdates=all en el POST del evento
- GCP proyecto: medscale-app-cal-int
- Callback Supabase en GCP: https://tfqakdffusydutmzditz.supabase.co/auth/v1/callback
- Callback app en GCP: https://app.medscale.app/api/google/callback

### Base de Datos — columnas clave
- `appointments.doctor_assignment_type` TEXT ('patient_choice' | 'auto_assigned')
- `appointment_types.rr_count_all` BOOLEAN (default true)
- `appointment_types.max_notice_days`, `buffer_before_min`, `buffer_after_min`
- `appointment_types.doctor_ids` UUID[] (array de doctores vinculados)
- `doctors.google_calendar_token` JSONB
- `doctors.user_id` UUID NOT NULL → `auth.users(id)`
- `doctors.default_duration` INT DEFAULT 30
- `organization_members`: tabla de roles por organización
- `messages`: organization_id, lead_id, channel, direction, content, is_read
- `organizations.ai_agent_enabled` BOOLEAN (default false)
- `organizations.plan` TEXT (free/starter/growth/scale)
- `organizations.onboarding_completed` BOOLEAN (default false)
- `organizations.contact_phone` TEXT
- `organizations.contact_email` TEXT

### Modos de asignación
| UI label | assignment_mode | rr_count_all |
|---|---|---|
| El paciente decide | one_on_one | true |
| Flexible | hybrid | true |
| Rotación — carga total | round_robin_proportional | true |
| Rotación — solo automáticas | round_robin_proportional | false |

### Pricing
| Plan | Precio/mes | Límites |
|---|---|---|
| Free | $0 | 1 médico, 50 leads, 20 citas/mes |
| Starter | $29 | 3 médicos, 100 citas/mes |
| Growth | $79 | 8 médicos, ilimitado |
| Scale | $149 | Ilimitado + API |

Ferttes: plan Growth (beta, sin restricciones)

---

## 🤖 Workflow de Claude Code

### Principios
- Verificación antes de done
- Bug fixing autónomo — ir directo a resolverlo
- Simplicidad primero, minimal impact
- No hacks — causa raíz siempre
- Siempre código/HTML completo listo para copiar y pegar
- No sugerir esperar si hay solución inmediata
- Antes de modificar un archivo importante, leer su contenido primero

### Estilo de trabajo MedScale
- Prompts atómicos, un cambio a la vez
- Git push al final de cada prompt
- Verificar rutas con PowerShell antes de asumir
- Comandos PowerShell, nunca bash Unix
- Screenshots para verificar antes de seguir
- ANTES de pushear cambios al sidebar o layout: build + start para verificar

### Cliente beta
- Ferttes (org_id: 4270c9b0-cbaa-4a94-bea7-508387a2529c)
- admin@ferttes.com | app.medscale.app
- 5 médicos activos, 291 leads, 234 citas históricas

### Cuenta de prueba
- Clinica LAb 2 (org_id: 669ed7cb-3e4d-43a7-8065-cfd7ee8de47c)
- labdepamdigital@gmail.com
