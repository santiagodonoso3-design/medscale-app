# CLAUDE.md — MedScale AI

Contexto técnico que Claude Code necesita en cada prompt.

**Complementa a:**
- `docs/OPERACION_MEDSCALE.md` — cómo se trabaja (principios, protocolos, roles)
- `docs/ESTADO_MEDSCALE.md` — foto viva (fases, deuda, decisiones, roadmap)

Este archivo se actualiza raro. Solo cambia cuando cambia el stack o aparece una regla técnica nueva no negociable.

---

## Stack

- **Framework:** Next.js 15 App Router (Turbopack en dev)
- **Lenguaje:** TypeScript estricto
- **Estilos:** Tailwind v4 + shadcn/ui
- **DB + Auth + Storage:** Supabase (proyecto `tfqakdffusydutmzditz`)
- **Email transaccional:** Resend
- **Payments:** Mercado Pago (Colombia, COP)
- **Deploy:** Vercel, plan Hobby, autodeploy desde `main`
- **Entorno local:** Windows + PowerShell (no bash)

**Repo:** `santiagodonoso3-design/medscale-app`
**Path local:** `C:\Users\sdono\claude-projects\Proyecto 1\medscale-app`

---

## Reglas críticas de código (no negociables)

### Next.js 15
- `params` es Promise → siempre `await params` antes de acceder a sus propiedades

### Autenticación y multi-tenancy
- Nunca confiar en `orgId`, `userId`, `plan`, `doctorId` del body del cliente
- Derivar identidad con `requireOrgContext()` o `requirePlatformAdmin()` (`lib/auth/session.ts`)
- Para sesión: `getSession()` retorna `{ user, orgId, email }` desde cookies
- `createServiceClient()` bypassea RLS — solo usar después de derivar identidad
- Toda query de negocio con service client debe llevar `.eq('organization_id', orgId)` con orgId derivado de sesión
- Webhooks y crons: validar con secret (`CRON_SECRET`, `x-webhook-secret`) en vez de sesión

### URLs de la app
- Nunca hardcodear `https://app.medscale.app` en código nuevo
- Usar helper `getAppUrl(request?)` de `lib/config/urls.ts`:
  - En browser: retorna `window.location.origin`
  - En server con request: `new URL(request.url).origin`
  - Server sin request: `process.env.NEXT_PUBLIC_APP_URL` o fallback prod

### Emails (from)
- `citas@medscale.app` — transaccionales de citas y automatizaciones
- `passwordreset@medscale.app` — reset password

### Schedules table gotcha
- `schedules` **no tiene** `organization_id` → filtrar por `doctor_id`
- Resolver unificado en `lib/availability/resolve.ts` (algunos consumidores viejos siguen sin migrar — ver ESTADO)

### day_of_week
- Convención: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado (igual que JS `getDay()`)
- DB CHECK constraint: `day_of_week BETWEEN 0 AND 6`
- **Bug latente:** `toDBDay` en `ManageAppointmentClient.tsx` retorna 7 para domingo. Rompe display de slots domingo en `/appointment/[token]/manage`

### Automation logs — idempotencia dura (Fase 0)
- UNIQUE constraint `(automation_rule_id, subject_type, subject_id, occurrence_key)`
- Patrón obligatorio en handlers: INSERT en `automation_logs` ANTES de `resend.emails.send()`
- Si INSERT falla con Postgres 23505 (unique_violation) → skip silencioso, no error
- `occurrence_key` debe ser determinístico (nunca `Date.now()` ni random)
- Ver `lib/automations/process.ts` líneas 12-58 para la tabla completa de keys por rule_type

### Audiences en reglas de automatización (Fase 1)
- Reservadas: `all`, `birthday`, `noshow` (tienen rama especial en el motor)
- Cualquier otro valor debe ser un `lead_statuses.key` activo de la org
- Validación en `validateAudience()` en `app/api/automations/route.ts`
- `rule_type = 'lead_status'` NO acepta `all` ni `birthday` (requiere status real)
- Guard en motor: si audience no reservada no existe en `lead_statuses` → skip con `console.error`, no romper cron

### Statuses de lead
- Catálogo por org en tabla `lead_statuses`
- Nunca hardcodear lista de statuses en código — leer del catálogo vía `GET /api/lead-statuses`
- Seis statuses base con `is_system=true`: `contactado`, `cita_valoracion_agendada`, `asistio_cita`, `cancelo_cita`, `en_tratamiento_medico`, `finalizado`
- Cada org puede agregar customs con `is_system=false`

---

## Estructura del repo

```
app/
├── (app)/                    Rutas autenticadas de la aplicación
│   ├── dashboard/
│   ├── crm/
│   ├── scheduling/
│   ├── doctors/
│   ├── team/                 Server actions en app/actions/team.ts
│   └── settings/
│       ├── automations/      Módulo de automatizaciones (rediseñado Fase 2)
│       ├── notifications/    Transaccionales por tipo de cita
│       ├── appointment-types/
│       └── integrations/     Google Calendar OAuth
├── (auth)/                   Login, register, reset password
├── admin/                    Superadmin (requirePlatformAdmin)
├── book/[org-slug]/          Booking público
├── appointment/[token]/      Manage/cancel/feedback pacientes
├── api/
│   ├── automations/          Motor CRM
│   ├── cron/                 Recordatorios diarios + cleanup
│   ├── webhooks/             MP, n8n, lead intake
│   ├── google/callback/      OAuth Google Calendar
│   └── ...
lib/
├── auth/session.ts           getSession(), requireOrgContext(), requirePlatformAdmin()
├── automations/process.ts    Motor de reglas CRM (7 handlers)
├── availability/resolve.ts   Resolver unificado de disponibilidad
├── config/urls.ts            getAppUrl() helper
├── email/
│   ├── templates.ts          brandShell + automationEmail + templates específicos
│   └── resend.ts             Cliente Resend
├── supabase/
│   ├── server.ts             createServiceClient() — bypassea RLS
│   └── client.ts             createClient() — browser, respeta RLS
└── organizations/
    └── seed-statuses.ts      Semilla de lead_statuses base al crear org
supabase/
└── migrations/               Historia de schema (drift con DB en vivo — ver protocolo abajo)
```

---

## Patrones de seguridad

### Server actions y API routes
```ts
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceClient()

  // Query siempre org-fenced con orgId de sesión, NUNCA del body
  const { data } = await admin
    .from('leads')
    .select('*')
    .eq('organization_id', session.orgId)
    .eq('id', bodyLeadId)  // otros filtros del body OK, pero organization_id de sesión
    .single()
}
```

### Webhooks
```ts
export async function POST(request: Request) {
  const signature = request.headers.get('x-webhook-secret')
  if (signature !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  // Solo después de validar secret, proceder
}
```

### Crons (Vercel)
```ts
export async function GET(request: Request) {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // Después del check, ejecutar
}
```

### Emails con branding
- Templates viven en `lib/email/templates.ts` (código, no DB)
- Branding del cliente viene de `organizations`: `name`, `logo_url`, `primary_color`, `contact_phone`
- Helper `brandFromOrg(org)` construye el objeto brand
- `automationEmail(orgName, body, cta?, brand)` renderiza HTML white-label
- **CTA color debe leer `brand.primaryColor`** — no hardcodear (bug histórico: algunas funciones tenían `#215F73` fijo, se está resolviendo en Template B)

---

## Patrones PROHIBIDOS

1. Confiar en el body del cliente para `orgId`, `userId`, `plan`, `doctorId`, `role`
2. `.from('users')` directo cuando se puede usar `getOrgIdFromUser()`
3. Query sin `.eq('organization_id', orgId)` con service client
4. Hardcode de `https://app.medscale.app` en código nuevo (usar `getAppUrl()`)
5. Hardcode de lista de statuses de lead en código (leer del catálogo `lead_statuses`)
6. `Date.now()` o random en `occurrence_key` de `automation_logs` (rompe idempotencia)
7. Llamar a `resend.emails.send()` en un handler de automations sin INSERT previo exitoso en `automation_logs`
8. Enum global de statuses de lead (cada org tiene su catálogo)
9. Correr `supabase db push` sin verificar drift (`schema_migrations` está desincronizado con repo)
10. Cambios a `appointment_type_notifications` sin ser conscientes de que hoy está separado del motor CRM

---

## Tablas críticas (columnas relevantes)

### `organizations`
- `id, name, slug` — identidad y URL pública
- `logo_url, primary_color, contact_phone` — branding para emails
- `plan, is_active, subscription_status, mp_preapproval_id` — billing
- `ai_agent_enabled, sidebar_theme, onboarding_completed` — features/config

### `leads`
- `organization_id` — org fence obligatoria
- `status` — free-form, debe existir en `lead_statuses.key` de la org
- `contact_email, contact_phone, contact_name, contact_cedula`
- `source, procedure_id, procedure_price`

### `lead_statuses`
- `(organization_id, key)` único
- `label, color, sort_order, is_active, is_system`
- Sistema: 6 base con `is_system=true` seeded por org

### `appointments`
- `status` — free-form, valores en producción: `scheduled`, `completed`, `cancelled`, `no_show`
- `EXCLUDE constraint appointments_no_overlap WHERE (status = 'scheduled')` — cancelled no bloquea slots
- `reminder_sent_at` — flag de dedup del sistema transaccional (separado de `automation_logs`)
- `manage_token` — UUID público para /appointment/[token]/manage

### `automation_rules`
- `rule_type` sin CHECK (texto libre, valores en `FIXED_RULE_TYPES` en código — deuda Fase 4)
- `audience` — reservada (`all`/`birthday`/`noshow`) o `lead_statuses.key`
- `email_subject`, `email_body` — con `{{variables}}` (`nombre`, `nombre_clinica`, `nombre_doctor`)
- `is_active` boolean

### `automation_logs`
- UNIQUE `(automation_rule_id, subject_type, subject_id, occurrence_key)` — idempotencia dura
- `status` CHECK: `sent`, `failed`, `skipped_unsubscribed`, `skipped_dedup`, `skipped_missing_email`
- `subject_type` CHECK: `lead`, `appointment`, `patient`

### `appointment_type_notifications`
- Sistema transaccional separado del motor CRM
- Por `appointment_type_id` + `event_type` (unique)
- `event_type` CHECK: `confirmation`, `reminder`, `cancellation`, `reschedule`
- `hours_before, to_patient, to_clinic` — comportamiento del envío

### `platform_admins`
- Solo para superadmin. Chequeo por `user_id`.
- Duplicado en env var `SUPERADMIN_EMAILS` (deuda: consolidar en un solo mecanismo).

---

## Migraciones y drift de schema

- `schema_migrations` tiene 3 rows en producción vs historia completa en repo
- **No correr `supabase db push`** — sería destructivo
- Aplicar migrations vía Supabase MCP con `apply_migration` desde el chat de diagnóstico
- Regla: repo (migraciones) = schema de diseño; DB en vivo = schema real. **Cuando driftean, gana la DB en vivo.**

---

## Gotchas conocidos con línea/archivo

- `ManageAppointmentClient.tsx` — `toDBDay` retorna 7 para domingo (debe ser 0)
- `/api/book/route.ts:330` — fail-open explícito en check de disponibilidad Google Calendar
- `manage/route.ts:101` — permite rescheduling a días bloqueados
- `getGoogleCalendarBusy` — catch-all con `return []` (fail-open silencioso)
- `POST /api/automations` — fuerza `is_active: true`, no permite crear pausada
- 3 `<img src="app.medscale.app/logo-*.png">` en `templates.ts` — se resuelven en Template B

Ver `docs/ESTADO_MEDSCALE.md` sección "Deuda técnica" para lista completa.

---

## Herramientas y accesos

- **Supabase MCP** conectado al chat de diagnóstico: proyecto `tfqakdffusydutmzditz`
- **Resend:** SPF+DKIM verificados. **DMARC pendiente** → causa delivery a spam en Hotmail/Outlook
- **n8n:** webhooks WhatsApp/IG/FB → `/api/conversations/webhook`
- **Google Cloud Console:** proyecto `medscale-app-cal-int` (816952703187), OAuth verificado por Google
- **Vercel:** env vars `CRON_SECRET, SUPERADMIN_EMAILS, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MP_ACCESS_TOKEN, GOOGLE_REDIRECT_URI, NEXT_PUBLIC_APP_URL`

---

## Estilo del código y de los prompts

- **Un cambio, un commit.** Si el trabajo mezcla dos scopes, dos commits atómicos.
- Los reportes de Claude Code se **verifican, no se creen** — grep + build + query DB.
- Los prompts van **completos en un solo bloque copiable**, PowerShell nativo Windows.
- SQL destructivo requiere OK explícito.
- No `git commit` ni `git push` desde Claude Code — eso lo hace Santiago.

Ver `docs/OPERACION_MEDSCALE.md` para protocolos completos.

---

**Última revisión técnica:** 3 de septiembre de 2026 (post-Fase 2 UX + refactor URLs completo).
