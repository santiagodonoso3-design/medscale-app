# MedScale App — Estado del proyecto (27 Mayo 2026)

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
  admin/impersonate.ts   → Impersonation de orgs (start/stop/get)
  supabase/server.ts     → createClient() + createServiceClient()
  supabase/client.ts     → cliente browser
  email/resend.ts        → envío de emails
  email/templates.ts     → templates HTML
  google/calendar.ts     → integración Google Calendar

app/
  (app)/                 → rutas protegidas del dashboard
  (auth)/                → login, register, reset-password
  (superadmin)/          → panel platform admin, protegido por SUPERADMIN_EMAILS + platform_admins
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
- ✅ Enforcement de límites por plan (`lib/plans.ts` + `checkPlanLimit`)
- ✅ API `/api/doctors/route.ts` con service role (reemplaza insert directo desde client)
- ✅ API `/api/plans/check/route.ts` para checks desde client components
- ✅ Superadmin: planes actualizados a free/starter/growth/scale con límites
- ✅ Logo upload bucket `'logos'` en Supabase Storage (público)
- ✅ `uploadOrgLogo` migrado a `createServiceClient()` y bucket `'logos'`

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
  | Dashboard | ✅✅ | ❌❌ | ❌❌ |
  | CRM | ✅✅ | ✅✅ | ❌❌ |
  | Agenda | ✅✅ | ✅✅ | ✅ solo suyas |
  | Doctores | ✅✅ | ✅ ver+disponibilidad | ✅ solo su perfil |
  | Conversaciones | ✅✅ | ✅✅ | ❌❌ |
  | Equipo | ✅✅ | ✅❌ | ❌❌ |
  | Configuración | ✅✅ | ✅✅ | Solo Integraciones |

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
- ✅ General, Sedes, Tipos de cita, Procedimientos, Notificaciones (global), Integraciones
- ✅ Settings layout filtra tabs según rol (doctor solo ve Integraciones)
- ✅ /settings/procedures: CRUD de procedimientos (nombre, precio COP, activo/inactivo) con cards UI
- ✅ API /api/procedures: GET, POST, PATCH, DELETE — filtrado por organization_id, service role

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
- ✅ Rediseño profesional 2 pasos: selección de plan (4 cards) + formulario (2 columnas)
- ✅ Brand kit aplicado: colores `#EBF0F6`, `#215F73`, `#5A9DB5`, `#0D2B3E`
- ✅ Headline "El sistema de crecimiento para tu consultorio"
- ✅ Precios en USD (US$0, US$29, US$79, US$149)
- ✅ API /api/register/complete: crea organización + organization_members con rol owner
- ✅ Redirige a /onboarding después del registro
- ✅ Teléfono removido del formulario (solo en onboarding)
- ⚠️ Google OAuth en registro NO crea organización — solo funciona con email+password

### UX Improvements
- ✅ Sidebar sticky + colapsable con tooltips
- ✅ CRM estilo Airtable: compacto, edge-to-edge
- ✅ Agenda y Conversaciones edge-to-edge
- ✅ Padding individual por página
- ✅ `app/page.tsx` redirige a /login (no muestra boilerplate)

### Logo y Branding (13 Mayo 2026)
- ✅ Fix logo upload: bucket corregido de `'logos'` a `'organizations'`
- ✅ Logo en sidebar: se muestra logo de org si existe, fallback a ícono
- ✅ Logo en booking público: `/book/[org-slug]` y booking wizard muestran logo
- ✅ Sidebar theme dark/light: columna `sidebar_theme` en organizations, selector en /settings/general
- ✅ Booking header rediseñado: logo izq + stepper der, sin "Reservar cita", "Powered by MedScale AI"
- ✅ Booking wizard: si tiene logo muestra solo logo, si no muestra nombre como fallback

### Superadmin (13 Mayo 2026)
- ✅ Protección /admin: solo emails en `SUPERADMIN_EMAILS` (env var) pueden acceder
- ✅ Tabla `platform_admins`: user_id, email, role (owner/admin/support)
- ✅ Superadmin actions migradas: `createServiceClient()`, columnas directas (no metadata), `organization_members` para user count
- ✅ CRUD organizaciones: plan, is_active, ai_agent_enabled editables desde modal
- ✅ Impersonation: cookie `impersonate_org_id` (httpOnly, 4h max), `getSession()` verifica `platform_admins` antes de respetar cookie
- ✅ Org switcher dropdown: en sidebar del tenant Y sidebar del superadmin, solo visible para platform admins
- ✅ Dashboard superadmin: métricas globales (orgs, usuarios, leads, citas)

### Conversaciones — Fixes (13 Mayo 2026)
- ✅ Fix agrupamiento: mensaje outbound ahora incluye `sender_phone` del lead (antes era null)
- ✅ Retención 48h: pg_cron `cleanup_old_messages` corre a las 3am diario, borra mensajes > 2 días
- ✅ Aviso retención en términos del agente y footer del chat

### Sistema de Permisos Granulares (20 Mayo 2026)
- ✅ Columna `permissions` JSONB en `organization_members`
- ✅ Helper `lib/permissions.ts`: getUserPermissions(), canAccess(), canEdit()
- ✅ `getSession()` devuelve permissions
- ✅ Sidebar filtra módulos por permisos reales (ya no por array de roles)
- ✅ 5 páginas protegidas con canAccess() + redirect (dashboard, crm, scheduling, conversations, doctors)
- ✅ readOnly en CRM, Agenda y Doctores (oculta botones CRUD cuando permiso es 'read')
- ✅ Modal de permisos en /team con radio buttons (Sin acceso / Solo lectura / Completo)
- ✅ API /api/team/permissions protegida (owner-only, misma org)
- ✅ 3 niveles: none | read | full — 5 módulos configurables (sin team ni settings)
- ✅ Owner siempre full, doctor siempre filtrado por doctor_id (reglas fijas)
- ✅ Backwards compatible: permissions NULL = defaults del rol

### Auditoría de Seguridad (20 Mayo 2026)
- ✅ Multi-tenant: team/invite validado por sesión y org_id
- ✅ RLS activado en tabla organizations
- ✅ APIs públicas verificadas: secrets + UUID tokens
- ✅ Settings layout protegido server-side: staff redirect, doctor solo /settings/integrations
- ✅ /team protegido: owner-only con getSession()
- ✅ Eliminado write a tabla legacy `users` en team/invite

### Sincronización Lead ↔ Cita (20 Mayo 2026)
- ✅ Cita completada → lead status: asistio_a_cita
- ✅ Cita cancelada → lead status: cancelo_cita
- ✅ Cita no_show → lead status: cancelo_cita
- ✅ Cita reagendada → lead no cambia
- ✅ Aplica en scheduling/actions.ts y api/appointment/manage/route.ts
- ✅ Solo actualiza si la cita tiene lead_id asociado

### UX (20 Mayo 2026)
- ✅ Empty states en Dashboard, CRM y Calendario
- ✅ Favicon actualizado a MedScale brand (MS AI)

### Sesión 27 Mayo 2026

#### Fixes y mejoras de booking
- ✅ Fix RLS appointment_types: policy migrada de public.users a get_user_org_id()
- ✅ Error amigable cuando slug de appointment_type duplicado
- ✅ Duración correcta en booking: usa appointment_type.duration_minutes, no doctor metadata
- ✅ Duración correcta en Google Calendar events (mismo fix)
- ✅ Texto dinámico de pago en booking: presencial="Se paga en el consultorio", virtual="Te enviaremos los detalles por email"
- ✅ Precios por modalidad: price_presencial y price_virtual en appointment_types (reemplaza price)

#### Disponibilidad y calendario
- ✅ Múltiples bloques horarios por día en disponibilidad de doctores
- ✅ Google Calendar FreeBusy: booking público bloquea slots ocupados del calendario del doctor
- ✅ Selección de calendario Google: si el doctor tiene múltiples calendarios, puede elegir cuál usar
- ✅ google_calendar_id se guarda al elegir, google_calendars temporal en metadata

#### CRM dinámico
- ✅ Tabla org_custom_fields: campos custom por organización (field_name, field_label, field_type, options, source)
- ✅ Custom fields se guardan en leads.metadata (JSONB) en vez de leads.notes
- ✅ CRM muestra columnas dinámicas desde org_custom_fields
- ✅ Botón "+" estilo Airtable para agregar campos desde el CRM
- ✅ Campos editables en modal de detalle del lead
- ✅ Búsqueda incluye valores de metadata
- ✅ Campo tipo "select" (dropdown) con opciones custom en formularios de agendamiento
- ✅ Options incluido en query de form fields para booking

#### Emails y notificaciones
- ✅ Fix: await en email a clínica (Vercel cerraba función antes de enviar)
- ✅ Múltiples destinatarios: contact_email soporta emails separados por coma
- ✅ Fix guardado de notification emails via API route (RLS bloqueaba update directo)
- ✅ Campos custom con labels legibles en email de notificación a clínica
- ✅ Cédula incluida en email a clínica
- ✅ Email de invitación branded via Resend (reemplaza email genérico de Supabase)
- ✅ Email de no_show: "¿No pudiste asistir?" con botón feedback + reagendar
- ✅ Email de cancelación mejorado: agregados botones feedback + reagendar
- ✅ Página de feedback: /appointment/[token]/feedback con razones predefinidas
- ✅ API /api/appointment/feedback: guarda razón en appointments.metadata.cancellation_reason

#### UX y diseño
- ✅ Tipos de cita: rediseño de tabla a cards (grid responsivo)
- ✅ Eliminar tipo de cita desde modal de edición (zona de peligro)
- ✅ Toggle ojo en campos de contraseña (login + reset-password)
- ✅ Términos y condiciones: checkbox en register, texto informativo en login, modal con contenido legal
- ✅ Logo MedScale en login, register, reset-password y emails
- ✅ Sidebar: solo muestra logo de la org (sin logo MedScale, branding correcto para SaaS)
- ✅ Favicon MS AI en formato PNG RGBA
- ✅ Integraciones visible en sidebar para rol doctor
- ✅ No_show agregado al dropdown rápido de estado en lista de citas

#### Superadmin
- ✅ Soft delete de orgs: 24h gracia + email de aviso al owner + cron de limpieza
- ✅ Acciones de desactivar/eliminar movidas dentro del modal de editar org

#### Migración datos
- ✅ Bariatric Latam: 99 leads + 99 citas migradas desde Airtable/Excel
- ✅ Metadata (entidad, fecha_nacimiento) migrada correctamente

#### Integraciones
- ✅ n8n webhook conectado para WhatsApp e Instagram de Bariatric Latam

#### Auth y CRM
- ✅ Estados custom del CRM: lead_statuses por organización
- ✅ Google OAuth en registro crea organización correctamente

### Cliente Bariatric Latam (27 Mayo 2026)
- org_id: f9ca61f7-49bb-4d1e-9d02-d5c77fc9bb87
- slug: dr-carlos-lopera
- carlosloperadigital@gmail.com
- 1 médico (Dr. Carlos Lopera), Google Calendar conectado
- 100 leads, 100 citas, plan Growth

### Sesión 27 Mayo 2026 — Parte 2

#### Dashboard rediseño completo
- ✅ KPI cards: Ingresos estimados (citas + procedimientos), Citas del período, Tasa de asistencia, Leads nuevos
- ✅ Ingresos = solo appointments con status completed × price
- ✅ Tasa asistencia = completed / (completed + no_show + cancelled), excluye scheduled
- ✅ Tendencia mensual: barras azules (agendadas), verdes (asistencias), moradas (finalizados), naranjas (procedimiento)
- ✅ Procedimientos y finalizados anclados a scheduled_at de última cita completed del lead (no created_at del lead)
- ✅ Ingresos por mes: bar chart stacked (verde=citas, violeta=procedimientos) con labels compactos (4.5M, 350K)
- ✅ Leads por estado: barras horizontales con distribución del período
- ✅ Actividad de citas: heatmap compacto últimos 30 días + métricas (semana, progreso mes, vs mes anterior)
- ✅ Agendamientos por día: bar chart últimos 14 días por created_at (no scheduled_at)
- ✅ Tabla por médico: columna Ingresos agregada (SUM price WHERE completed + procedimientos)
- ✅ Razones de cancelación y no-show al final (desde appointments.metadata.cancellation_reason)

#### Procedimientos
- ✅ Tabla `procedures`: id, organization_id, name, price, is_active
- ✅ CRUD en /settings/procedures con cards UI
- ✅ API /api/procedures: GET, POST, PATCH, DELETE — filtrado por organization_id, service role
- ✅ CRM: dropdown "Procedimiento realizado" cuando lead status = en_tratamiento_medico
- ✅ `leads.procedure_id` y `leads.procedure_price` guardan snapshot del procedimiento asignado
- ✅ Dashboard: ingresos totales = citas completed + procedimientos. Chart stacked bar.

#### Appointments — columnas nuevas
- ✅ `appointment_type_id` UUID FK → appointment_types (guardar siempre al crear)
- ✅ `modality` TEXT ('presencial' | 'virtual')
- ✅ `price` INTEGER (precio COP al momento de crear la cita — snapshot)
- ✅ Booking público y cita manual guardan los 3 campos
- ✅ Backfill Bariatric Latam: todas las citas con price = 350000

#### Permisos actualizados
- ✅ Staff en /dashboard → redirect a /crm (no tiene acceso)
- ✅ /team readOnly para staff (ve lista, no puede invitar/editar/eliminar)
- ✅ /settings accesible para staff (todas las secciones)

#### Sistema de referidos
- ✅ Tabla `referral_codes`: CRUD completo desde superadmin `/admin/referrals`
- ✅ Tabla `referral_uses`: registro de uso por organización
- ✅ `organizations.referral_code_id`: FK al código usado en el registro
- ✅ API `/api/referrals`: GET/POST/PATCH — superadmin only (verifica SUPERADMIN_EMAILS)
- ✅ API `/api/referrals/validate?code=XXX`: endpoint público — valida código activo, no expirado, con cupo
- ✅ `/register`: campo opcional "Código de referido" con validación en tiempo real (debounce 500ms)
- ✅ Badge verde "Descuento de X% aplicado · Referido por [nombre]" si código válido
- ✅ `/api/register/complete`: re-valida server-side, guarda `referral_code_id`, inserta en `referral_uses`, incrementa `times_used`
- ✅ `/api/referrals/validate` excluido del middleware (ruta pública)

#### Backfills
- ✅ `appointments.created_at` corregido con fechas reales del CRM de Bariatric (99 registros)
- ✅ `appointments.doctor_assignment_type` = patient_choice para todas las citas de Bariatric

---

## 🔴 PRIORIDAD 1 — MVP Autoservicio
_(cobro manual desde superadmin por ahora — sin tareas activas)_

## 🟡 PRIORIDAD 2
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

**appointments tiene appointment_type_id, modality y price — siempre guardarlos al crear citas**

**procedures: catálogo por organización, price se guarda como snapshot en leads.procedure_price al asignar**

**Procedimientos y finalizados en dashboard se anclan a scheduled_at de última cita completed del lead, no a created_at**

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

**Inserts de doctors deben ir por `/api/doctors` con service role, no directos desde client**

**Superadmin usa `createServiceClient()`, NUNCA `createClient()`** — necesita acceso cross-tenant sin RLS

**Impersonation:** cookie `impersonate_org_id` solo se respeta si `user_id` existe en `platform_admins`

**Logo upload va al bucket `organizations` (path: `logos/{orgId}.{ext}`), NO al bucket `logos`**

**Permisos por módulo:** usar canAccess(perms, module) para visibilidad, canEdit(perms, module) para CRUD. Importar de lib/permissions.ts. Nunca filtrar sidebar por array de roles — usar getUserPermissions() + canAccess().

**Sincronización lead ↔ cita:** al cambiar status de appointment a completed/cancelled/no_show, actualizar el lead correspondiente. Ver scheduling/actions.ts.

**Custom fields se guardan en leads.metadata** — NO en leads.notes

**appointment_types usa price_presencial y price_virtual** — NO price

### Roles — Protección
- Protección por rol en `layout.tsx` y páginas vía `getSession()`
- Doctor permitido: /scheduling, /doctors, /settings/integrations
- Staff bloqueado: /dashboard, /admin
- Staff solo lectura: /team (puede ver lista, no invitar/editar/eliminar)
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
- `organizations.plan` TEXT (free/starter/growth/scale)
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
- `org_custom_fields`: organization_id, field_name, field_label, field_type, options[], source, sort_order, active
- `referral_codes`: code (unique, uppercase), referrer_name, referrer_email, referrer_phone, discount_type (percentage|fixed_amount), discount_value, discount_duration_months, commission_type, commission_value, commission_duration_months, max_uses, times_used, is_active, expires_at
- `referral_uses`: referral_code_id, organization_id, discount_applied, status (active|expired|cancelled), applied_at
- `organizations.referral_code_id` UUID FK → referral_codes (código usado en el registro)

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
- Siempre verificar que inserts incluyan `organization_id`
- Para crear recursos (doctors, leads), usar API routes con service role, no inserts directos desde client
- Verificar plan limits antes de inserts de recursos limitados

### Cliente beta
- Ferttes (org_id: 4270c9b0-cbaa-4a94-bea7-508387a2529c)
- admin@ferttes.com | app.medscale.app
- 5 médicos activos, 291 leads, 234 citas históricas

### Cliente Bariatric Latam
- org_id: f9ca61f7-49bb-4d1e-9d02-d5c77fc9bb87
- slug: dr-carlos-lopera | carlosloperadigital@gmail.com | plan Growth
- 1 médico (Dr. Carlos Lopera), Google Calendar conectado
- 100 leads, 100 citas

### Cuenta de prueba
- Clinica LAb 2 (org_id: 669ed7cb-3e4d-43a7-8065-cfd7ee8de47c)
- labdepamdigital@gmail.com | plan starter
- 3 médicos, usada para testing de onboarding y enforcement de límites
