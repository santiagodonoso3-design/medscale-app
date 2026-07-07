# MedScale App — Estado del proyecto (3 Junio 2026)

> Para historial de sesiones ver CHANGELOG.md

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

**4. Service client para operaciones admin (RLS bypass — identidad PRIMERO):**
```typescript
import { createServiceClient } from '@/lib/supabase/server'
const admin = createServiceClient() // síncrono, NO async
```
Service role SOLO después de derivar identidad con `requireOrgContext()`/`requirePlatformAdmin()` (lib/auth/session.ts) para sesión de usuario, o validación de secret (`x-webhook-secret`, `CRON_SECRET`) para webhooks/crons. NUNCA confiar en orgId/userId/plan/doctorId del body del cliente. Toda query de negocio con service client lleva `.eq('organization_id', orgId)` derivado de sesión.

**5. Client de auth para server components:**
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient() // async, usa cookies
```

**6. Server action con service role — patrón canónico (ver `app/actions/team.ts`):**
```typescript
import { requireOrgContext } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

export async function updateMemberRole(memberId: string, newRole: string) {
  const { userId, orgId, role } = await requireOrgContext()  // 1. identidad de sesión
  if (role !== 'owner') throw new Error('FORBIDDEN')          // 2. check de rol
  const admin = createServiceClient()
  const { data: member } = await admin
    .from('organization_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('organization_id', orgId)                            // 3. verificar pertenencia al org
    .single()
  if (!member) throw new Error('FORBIDDEN')
  await admin.from('organization_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .eq('organization_id', orgId)                            // 4. query fenceada por org
}
```
Las tres actions de `app/actions/team.ts` (`updateMemberRole`, `removeMember`, `removeDoctorMembership`) siguen este patrón: `requireOrgContext()` → check de rol → verificación de pertenencia al org → query fenceada por `organization_id`.

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

// ❌ NUNCA — confiar en orgId/userId/plan/doctorId del body del cliente
// service role bypassa RLS → un orgId del cliente = acceso cross-tenant.
// Derivar SIEMPRE de requireOrgContext()/requirePlatformAdmin() (sesión) o secret (webhook/cron).
const { orgId } = await req.json() // ← INCORRECTO: derivar con requireOrgContext()

// ❌ NUNCA — createServerClient con service role key
// createServerClient es para cookies/auth, NO para service role
import { createServerClient } from '@supabase/ssr'
createServerClient(url, SERVICE_ROLE_KEY) // ← INCORRECTO

// ❌ NUNCA — acceder a params sin await en Next.js 16
const slug = params['org-slug'] // ← crash
// ✅ CORRECTO:
const resolvedParams = await params
const slug = resolvedParams['org-slug']
```

### Reglas de auditoría (lecciones aprendidas — 6 jun 2026)

**ANTES de borrar (DROP) cualquier tabla, barrer las CINCO vías de dependencia — el grep de código NO basta:**
1. Código TypeScript (grep de la tabla)
2. Foreign keys entrantes (`information_schema.table_constraints`)
3. Funciones SQL (`information_schema.routines` — buscar el nombre de la tabla en `routine_definition`)
4. Policies RLS (`pg_policies` — buscar en `qual` y `with_check`)
5. Triggers (`information_schema.triggers`)
Causa: se dropeó `superadmins` sin revisar funciones; la función `is_superadmin()` la usaba y tumbó `/doctors` en producción.

**Migrar el consumidor ANTES de dropear, NUNCA después.** Orden correcto: (1) arreglar/repuntar todo lo que apunta a la tabla, (2) verificar cero referencias, (3) dropear. Hacerlo al revés causa caída en producción.

**Las funciones de seguridad (is_superadmin, has_role, etc.) SOLO apuntan a tablas vivas:** `platform_admins`, `auth.users`, `organization_members`. NUNCA a tablas legacy. La fuente de verdad de identidad es `auth.users` + `organization_members`.

**Los campos custom del CRM se derivan del booking automáticamente vía la vista `crm_fields`.** El CRM lee de `crm_fields` (NO de `org_custom_fields` directo). La vista une: campos del booking (`appointment_form_fields`, marcados `source='form'`) + campos manuales del CRM (`org_custom_fields` con `source='crm'`). NO espejar campos a mano. Solo escribir a `org_custom_fields` para campos manuales con `source='crm'`.

**Al eliminar rutas en Next.js, limpiar `.next` antes del rebuild** (`Remove-Item -Recurse -Force .next`). Saltarlo da errores falsos de tipos por caché stale.

**El esquema legacy fue desmantelado (6 jun 2026):** eliminadas las tablas `users`, `lead_fields`, `lead_values`, `conversations`, `conversation_messages`, `user_permissions`, `permissions`, `locations_rooms`, `superadmins` y las funciones `has_permission`, `has_role`. NO recrearlas ni referenciarlas. Identidad = `auth.users` + `organization_members`. Custom fields = `leads.metadata` + `org_custom_fields`. Mensajes = `messages`.

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
  auth/session.ts        → getSession(), requireOrgContext(), requirePlatformAdmin()
  get-org-id.ts          → getOrgIdFromUser() — para actions/APIs
  admin/impersonate.ts   → Impersonation de orgs (start/stop/get)
  supabase/server.ts     → createClient() + createServiceClient()
  supabase/client.ts     → cliente browser
  email/resend.ts        → envío de emails
  email/templates.ts     → templates HTML
  google/calendar.ts     → integración Google Calendar
  date.ts                → helpers de fecha Bogotá (FUENTE ÚNICA)

app/
  (app)/                 → rutas protegidas del dashboard
  (auth)/                → login, register, reset-password
  (superadmin)/          → panel platform admin, protegido por SUPERADMIN_EMAILS + platform_admins
  onboarding/            → wizard post-registro
  book/                  → agendamiento público
  api/                   → API routes
```

### Fechas y timezone (Bogotá, UTC-5, sin DST)

- `lib/date.ts` es la **FUENTE ÚNICA** de verdad para fechas. Usar sus helpers: `buildBogotaISO(dateStr, timeStr)`, `bogotaDayStr(iso)`, `bogotaTimeStr(iso)`, `bogotaMonthStr(iso)`, `todayBogotaStr()`, `bogotaWeekday(iso)`.
- **PROHIBIDO:** `.slice(0,10)` sobre un timestamp de la DB (da el día en UTC, no en Bogotá — desfasa citas nocturnas al día siguiente). Usar `bogotaDayStr(iso)`.
- **PROHIBIDO:** ``new Date(`${fecha}T${hora}`)`` sin offset (Vercel corre en UTC → interpreta la hora como UTC). Usar `buildBogotaISO(fecha, hora)`, que aplica `-05:00`.
- Los 4 paths de creación de cita (`/api/book`, `crm/book-appointment-modal`, `scheduling/calendar-client-fixed`, `appointment/manage`) ya construyen con `-05:00` correcto. `calendar-client-fixed.tsx` ya migrado a `bogotaDayStr` para agrupar por día.
- **Deuda:** quedan `.slice(0,10)` sobre `scheduled_at` en otros archivos (dashboard ya usa su propio helper correcto; verificar caso por caso antes de migrar — no todo `.slice` es bug).

### Auditoría de seguridad — estado (sesión jul 2026)

- **Patrón canónico obligatorio:** identidad (`requireOrgContext`/`requirePlatformAdmin`) → check de rol → verificación de pertenencia a org → query fenceada con `.eq('organization_id', orgId)` derivado de sesión. Ejemplo canónico: `app/actions/team.ts` (ver patrón obligatorio #6).
- **Cerrado y verificado:** superadmin actions, register/complete, dashboard, settings, importLeads, `/api/doctors`, `/api/onboarding` step1-4, `/api/book` (valida doctor∈org), scheduling actions, google disconnect/select-calendar, request-agent, plans/check, referrals/validate, crons con guard de `CRON_SECRET`.
- **Congelado (no tocar):** NB-2/C-8 — OAuth `state` sin firmar en `/api/google/callback` y `/api/google/auth`, pendiente de verificación de Google. No modificar el flujo OAuth hasta el veredicto.
- **Backlog de seguridad pendiente:** NB-9 (webhooks con `WEBHOOK_SECRET` global — rediseñar a secret/firma por-org), NB-14 (endpoints CRM sin `canEdit` — defensa en profundidad), NB-16 (comparación de firma MP no constante), NB-18/19/20 (bajos).

---

## 🔴 PRIORIDAD 1 — MVP Autoservicio
_(cobro manual desde superadmin por ahora — sin tareas activas)_

## 🟡 PRIORIDAD 2
- [ ] Moneda configurable por organización: columna `currency` en organizations (default 'COP'). Monedas soportadas: COP, USD, MXN, ARS, CLP, PEN, BRL, UYU, BOB, PYG, CRC, PAB, DOP, GTQ, HNL, NIO, SVC. Aplicar formato de moneda en dashboard, booking, settings, CRM. Helper `formatCurrency(amount, currency)` centralizado.
- [ ] Tour opcional post-onboarding
- [ ] Verificar buffer_before/after_min con citas reales
- [ ] Limpiar temp_register.txt del repo
- [ ] "FOR HEALTHCARE GROWTH" duplicado en emails (sale en logo y como texto)
- [ ] Dropdown de estado se corta en borde inferior de pantalla (scheduling)

## 🟢 PRIORIDAD 3 — Superadmin evolución
- [ ] Dashboard superadmin con métricas avanzadas (MRR, churn, uso por org)
- [ ] Feature flags por organización (tabla dedicada)
- [ ] Gestión usuarios por organización desde superadmin
- [ ] Cupones/promos (cuando haya Stripe)
- [ ] Logs/auditoría

## 🔵 Fase 2
- [ ] Stripe billing con trial 14 días
- [ ] Google Calendar bidireccional
- [ ] WhatsApp via Meta Cloud API
- [ ] Módulo historia clínica
- [ ] Motor de automatizaciones
- [ ] Módulo formularios
- [ ] Reportes y analítica avanzada
- [ ] Eliminar tabla `public.users` completamente
- [ ] Migrar superadmin a subdominio admin.medscale.app (cuando 10+ clientes)

---

## 🕒 Deuda técnica diferida (con trigger)

Pendientes que NO se atacan ahora a propósito — cada uno tiene un trigger que indica cuándo dejar de ignorarlo. Anotados en la auditoría del 6 jun 2026.

- [ ] **Escala de automatizaciones birthday/special_date.** Hoy cargan TODOS los leads de la org en memoria y filtran cumpleaños en JS. Trivial a cientos de leads. **Trigger: cuando una org supere ~5k leads.** Fix: normalizar formato de cumpleaños en metadata + índice funcional + filtrar por mes/día en SQL. ~1-2h. No antes.

- [ ] **Barrido de código huérfano con knip.** Detecta archivos/exports/dependencias que nadie usa (lo que hoy cazamos a mano). **Trigger: sesión de auditoría periódica.** Requiere crear knip.json con config de Next.js ANTES de correrlo (Next carga page/layout/route/middleware por convención, no por import — sin la config los marca como falsos positivos). Knip solo reporta, no borra: verificar cada candidato con grep antes de eliminar.

- [ ] **ESLint duro (bloqueo automático).** Hoy la verificación de reglas es el script manual check-rules.ps1 (avisa, no bloquea). **Trigger: si el script manual deja de bastar** — más devs en el proyecto, o se quiere que el build FALLE ante un patrón prohibido en vez de solo avisar. Riesgo: crear config ESLint en Next.js 15 sin config previa puede romper el build; hacerlo con cabeza fresca, no al final de una sesión.

- [ ] **Cinturón redundante de organization_id en cron de reminders.** app/api/cron/reminders/route.ts aísla por tenant de forma IMPLÍCITA (vía appointment_type_id, que es único por org). Funciona, pero es frágil si algún día un tipo de cita se comparte entre orgs. **Trigger: antes de permitir tipos de cita compartidos, o en próxima refactor del cron.** Fix: agregar .eq('organization_id', notif.organization_id) explícito como cinturón redundante.

- [ ] **Backfill de performed_at en procedimientos viejos.** Procedimientos sin performed_at caen por cascada al mes de la cita, no del procedimiento — puede descuadrar el mes en dashboard. **Trigger: si se requiere precisión histórica exacta en métricas de procedimientos.** Fix: backfillear performed_at desde la última cita completed del lead.

- [ ] **Extender `requireOrgContext()` para retornar `permissions` y migrar gates a `canEdit()`.** Hoy `requireOrgContext()` solo devuelve `{ userId, orgId, role }`, así que los gates de `app/actions/team.ts` (`removeDoctorMembership`) e `importLeads.ts` chequean por ROL (`role !== 'owner'` / `role === 'doctor'`), no por permiso fino. **Trigger: cuando se quiera respetar overrides de permisos por miembro (ej. un owner que revoca CRM a un staff con `doctors:'full'`).** Fix: agregar `permissions` al retorno de `requireOrgContext()` y reemplazar los checks de rol por `canEdit(perms, 'crm'|'team'|...)` de lib/permissions.ts.

- [ ] **Unificar `importLeads.ts` a `createServiceClient()`.** `app/(app)/crm/actions/importLeads.ts` construye su propio cliente service role a nivel de módulo con `createClient` de `@supabase/supabase-js`, en vez del helper `createServiceClient()` de lib/supabase/server. **Trigger: próxima refactor del CRM o del flujo de import.** Fix: reemplazar por `createServiceClient()` para un único punto de construcción del cliente service role.

---

## 🏗️ Decisiones Técnicas

### Arquitectura
- **Patrón:** Monolito modular (NO microservicios)
- **Frontend:** Next.js 16 con App Router
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel (autodeploy desde GitHub, branch main)
- **Auth:** `getSession()` centralizado, middleware ligero
- **Multi-tenant:** `organization_id` en toda query de negocio

### ⚠️ Reglas críticas de código

**Next.js 16 — params es Promise:**
```typescript
const resolvedParams = await params
const slug = resolvedParams['org-slug']
```

**schedules no tiene organization_id — filtrar por doctor_id**

**appointments tiene appointment_type_id, modality y price — siempre guardarlos al crear citas**

**procedures: catálogo por organización, price se guarda como snapshot en leads.procedure_price al asignar**

**Procedimientos en dashboard se anclan a `lead_procedures.performed_at` (fecha real del procedimiento), NO a la cita del lead. Si performed_at es null, cascada: última cita completed → created_at del procedimiento. Ver sección "Dashboard — anclaje de series".**

**`createServiceClient()` es SÍNCRONO — no usar await**

**contact_email de organizations NO viene del join — query separado**

**File objects no se serializan en server actions — usar base64 con FileReader**

**Upload a Storage siempre con service role**

**await en TODOS los resend.emails.send() — sin await Vercel cierra la función**

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

**NUNCA usar `from('users')` para obtener `organization_id`** — usar `getSession()` o `getOrgIdFromUser()`

**NUNCA agregar queries a DB en el middleware**

**Toda query a datos de negocio DEBE incluir `.eq('organization_id', orgId)`**

**Inserts de doctors van por `/api/doctors` (POST) — exige sesión de OWNER y deriva la org de la sesión con `requireOrgContext()`; NO acepta orgId/userId del body. Mismo patrón en `/api/onboarding/step2`. Nunca inserts directos desde client.**

**Superadmin usa `createServiceClient()`, NUNCA `createClient()`** — necesita acceso cross-tenant sin RLS

**Impersonation:** cookie `impersonate_org_id` solo se respeta si `user_id` existe en `platform_admins`

**Logo upload va al bucket `organizations` (path: `logos/{orgId}.{ext}`), NO al bucket `logos`**

**Permisos por módulo:** usar canAccess(perms, module) para visibilidad, canEdit(perms, module) para CRUD. Importar de lib/permissions.ts. Nunca filtrar sidebar por array de roles — usar getUserPermissions() + canAccess().

**Sincronización lead ↔ cita:** al cambiar status de appointment a completed/cancelled/no_show, actualizar el lead correspondiente. Ver scheduling/actions.ts.

**Custom fields se guardan en leads.metadata** — NO en leads.notes

**appointment_types usa price_presencial y price_virtual** — NO price

**Migración de fechas desde Excel — riesgo de inversión día/mes:** El formato datetime de Excel arrastra inversión día↔mes según localización. SIEMPRE usar la columna de texto explícito ("11 May 2026") como fuente de verdad cuando exista, no el datetime crudo. Verificar distribución por mes (`SELECT to_char(scheduled_at,'YYYY-MM'), COUNT(*)`) ANTES de dar por buena la carga.

**Match lead↔cita en migraciones:** normalizar teléfono a últimos 10 dígitos (quitar prefijo 57) da el match más confiable cuando no hay cédula/email.

**Campos custom viven en DOS sistemas que NO se hablan:** `appointment_form_fields` (booking → metadata) y `org_custom_fields` (columnas del CRM). Para que el CRM muestre campos del booking, espejarlos en `org_custom_fields` con `source='form'`. DEUDA TÉCNICA: centralizar en fuente única (hoy hardcodeado en 4 lugares: wizard, settings admin, CRM header, modal cita).

**`org_custom_fields.source` CHECK constraint:** solo acepta `'form' | 'crm' | 'both'`.

### Roles — Protección
- Protección por rol en `layout.tsx` y páginas vía `getSession()`
- Doctor permitido: /scheduling, /doctors, /settings/integrations
- Staff bloqueado: /dashboard, /admin
- Staff solo lectura: /team (puede ver lista, no invitar/editar/eliminar)
- /team es FUNCIONAL (ya no placeholder): owner invita/cambia rol/elimina miembros vía server actions en `app/actions/team.ts`. Las mutaciones NO van directas desde el browser — la policy de escritura de `organization_members` se eliminó, así que toda escritura pasa por server action con `requireOrgContext()` + check owner. Ver patrón obligatorio #6.
- Staff acceso completo: /crm, /scheduling, /conversations, /settings/*
- Doctor en /dashboard → redirect a /scheduling/calendar
- **NO hay verificación de roles en middleware**

### Roles — DB
- Tabla: `organization_members` (organization_id, user_id, role, doctor_id)
- roles: `'owner' | 'staff' | 'doctor'`
- Leer rol: `getSession().role`
- `doctors.user_id` referencia `auth.users(id)`, NO `public.users`

### Superadmin — Arquitectura
- Tabla `platform_admins` controla quién es superadmin (no env var sola)
- Env var `SUPERADMIN_EMAILS` protege el layout server-side como primera barrera
- `getSession()` soporta impersonation: si hay cookie `impersonate_org_id` y user es platform_admin, devuelve orgId de la cookie con `role: 'owner'` e `isImpersonating: true`
- Org "Medscale" (883367a9-...) es la org base del superadmin — necesaria para que `getSession()` funcione cuando no impersona
- Sidebar muestra org switcher dropdown solo para platform admins
- Superadmin actions usan `createServiceClient()` para acceso cross-tenant

### Superadmin — Roadmap arquitectura
- **Hoy:** superadmin vive en misma app, protegido por email + platform_admins
- **10+ clientes:** migrar a subdominio admin.medscale.app (proyecto Next.js aparte, misma DB)
- **Marca blanca (futuro):** agregar nivel "Reseller" entre Platform y Tenant

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
- `appointments.appointment_type_id` UUID FK → appointment_types (guardar siempre al crear)
- `appointments.modality` TEXT ('presencial' | 'virtual')
- `appointments.price` INTEGER (precio al momento de la cita)
- `appointment_types.rr_count_all` BOOLEAN (default true)
- `appointment_types.max_notice_days`, `buffer_before_min`, `buffer_after_min`
- `appointment_types.doctor_ids` UUID[] (array de doctores vinculados)
- `doctors.google_calendar_token` JSONB
- `doctors.user_id` UUID NOT NULL → `auth.users(id)`
- `doctors.default_duration` INT DEFAULT 30
- `organization_members`: tabla de roles por organización
- `messages`: organization_id, lead_id, channel, direction, content, is_read
- `organizations.ai_agent_enabled` BOOLEAN (default false)
- `organizations.plan` TEXT (consultorio/clinica/red)
- `organizations.onboarding_completed` BOOLEAN (default false)
- `organizations.contact_phone` TEXT
- `organizations.contact_email` TEXT
- `organizations.sidebar_theme` TEXT (dark/light, default dark)
- `organizations.is_active` BOOLEAN (default true)
- `organizations.pending_deletion_at` TIMESTAMPTZ (soft delete — 24h gracia antes de borrar)
- `platform_admins`: user_id, email, role (owner/admin/support) — controla acceso a superadmin
- `organization_members.permissions` JSONB (null = defaults del rol)
- `appointment_types.price_presencial` INT (reemplaza price)
- `appointment_types.price_virtual` INT (reemplaza price)
- `appointments.metadata` JSONB (cancellation_reason, custom data)
- `leads.metadata` JSONB (custom fields del formulario de agendamiento)
- `leads.procedure_id` UUID FK → procedures (null si no tiene procedimiento asignado)
- `leads.procedure_price` INTEGER (snapshot del precio al momento de asignar el procedimiento)
- `procedures`: id, organization_id, name TEXT, price INTEGER, is_active BOOLEAN
- `lead_procedures`: id, organization_id, lead_id, procedure_id, procedure_price (snapshot), performed_at DATE (fecha real del procedimiento, nullable), created_at. FUENTE DE VERDAD de procedimientos en el dashboard (1 lead → N procedimientos). performed_at es tipo `date` puro: NUNCA formatear con timezone (retrocede un día). Usar fmtDateOnly, no fmtDate.
- `org_custom_fields`: organization_id, field_name, field_label, field_type, options[], source, sort_order, active
- `referral_codes`: code (unique, uppercase), referrer_name, referrer_email, referrer_phone, discount_type (percentage|fixed_amount), discount_value, discount_duration_months, commission_type, commission_value, commission_duration_months, max_uses, times_used, is_active, expires_at
- `referral_uses`: referral_code_id, organization_id, discount_applied, status (active|expired|cancelled), applied_at
- `organizations.referral_code_id` UUID FK → referral_codes (código usado en el registro)
- `automation_rules`: id, organization_id, rule_type, name, description, delay_days, trigger_date, email_subject, email_body, is_active, created_at, updated_at
- `automation_logs`: id, organization_id, automation_rule_id, lead_id, email_sent_to, status, sent_at
- `automation_rules.rule_type`: followup_post_cita | noshow_recovery | procedure_followup | procedure_completed | birthday | special_date

### Dashboard — anclaje de series (CRÍTICO, leer antes de tocar)

Archivos: `app/(app)/dashboard/actions.ts` (fetch + cascada de fechas) y `dashboard-client.tsx` (computeMetrics + render).

**Regla maestra: cada métrica se ancla a SU propia fecha del evento, no a la fecha del lead.** Las dos gráficas que muestran procedimientos (Tendencia mensual y Embudo) DEBEN leer de la misma fuente o se desincronizan.

**Tendencia mensual (3 series, NO 4 — "Finalizados" se eliminó):**
| Serie | Cuenta | Mes en que cae | Fuente |
|---|---|---|---|
| Agendadas | citas | scheduled_at | appointments |
| Asistencias | citas status=completed | scheduled_at | appointments |
| Procedimiento | procedimientos | procedure_month (= performed_at) | procedureLeads (lead_procedures) |

"Finalizados" se quitó: bajo Opción B un procedimiento hecho ES el desenlace del lead, así que duplicaba la serie Procedimiento con otra fecha. El desenlace sigue visible en el Embudo.

**Embudo de conversión (3 pasos, alineado con Tendencia mensual):**
- Agendó cita = leads únicos con cita en el período (base 100%)
- Asistió = leads únicos con cita completed en el período
- Llegó a tratamiento = leads únicos con procedimiento cuyo procedure_month cae en el período (mismo origen que la barra Procedimiento, NO por leads.status)
- Porcentajes: todos sobre "Agendó" (no sobre el paso anterior), porque al mezclar cohortes el % de paso pierde sentido. El embudo NO es estrictamente monotónico (tratamiento puede venir de cohortes que asistieron otro mes) — es intencional, mide actividad del mes, no cohorte.

**Cascada de fecha del procedimiento (procedure_month en actions.ts):**
1. `performed_at` si existe (YYYY-MM directo, sin timezone)
2. última cita completed del lead (toBogotaYM)
3. created_at del procedimiento (fallback)
DEUDA: procedimientos viejos sin performed_at caen por la cascada (paso 2/3), lo que puede ubicarlos en el mes de la cita, no del procedimiento. Backfillear performed_at para precisión.

**Ingresos (KPI + "Ingresos por mes"):** citas completed × price + suma de lead_procedures.procedure_price del mes. Procedimientos por procedure_month, igual que la barra.

**Status del lead (en_tratamiento_medico, finalizado) YA NO alimenta ninguna serie del dashboard.** Sirve para el CRM/pipeline, no para métricas. No revertir a contar por status.

### Modos de asignación
| UI label | assignment_mode | rr_count_all |
|---|---|---|
| El paciente decide | one_on_one | true |
| Flexible | hybrid | true |
| Rotación — carga total | round_robin_proportional | true |
| Rotación — solo automáticas | round_robin_proportional | false |

### Pricing
| Plan        | Precio/mes            | Límites                          |
|-------------|-----------------------|----------------------------------|
| Consultorio | $89                   | 1 médico, 1 sede                 |
| Clínica     | $249 (recomendado)    | Hasta 6 médicos, 1 sede          |
| Red         | A medida (desde $549) | Médicos y sedes ilimitados + API |

Sin plan gratuito. Segmentación por médicos/sedes, no por citas/mes.

Ferttes: plan Clínica (beta, sin restricciones)

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
- Siempre verificar que inserts incluyan `organization_id`
- Para crear recursos (doctors, leads), usar API routes con service role, no inserts directos desde client
- Verificar plan limits antes de inserts de recursos limitados

### Cliente beta
- Ferttes (org_id: 4270c9b0-cbaa-4a94-bea7-508387a2529c) | admin@ferttes.com | app.medscale.app | plan Clínica (beta, sin restricciones)

### Cliente Bariatric Latam
- org_id: f9ca61f7-49bb-4d1e-9d02-d5c77fc9bb87 | slug: dr-carlos-lopera | carlosloperadigital@gmail.com | plan Clínica

### Cuenta de prueba
- Clinica Lab 2 (org_id: 669ed7cb-3e4d-43a7-8065-cfd7ee8de47c) | labdepamdigital@gmail.com | plan Consultorio — NOTA: org eliminada, reemplazar con nueva org de prueba
