# MedScale App — Estado del proyecto (9 Mayo 2026)

## ✅ Completado

### Auth y Deploy
- ✅ Login en producción (Supabase Auth)
- ✅ Sign in with Google — OAuth 2.0 con vinculación de cuentas por email
- ✅ /auth/callback — maneja redirect de Google OAuth
- ✅ Variables de entorno en Vercel
- ✅ Middleware protección de rutas (/book/* público)
- ✅ "Olvidé mi contraseña" — flujo completo con email desde passwordreset@medscale.app
- ✅ /reset-password — maneja invite + recovery flows (Suspense boundary)
- ✅ SMTP configurado en Supabase con Resend (bypasea rate limit)
- ✅ Email template reset password con logo MedScale y diseño branded
- ✅ Allow manual linking habilitado en Supabase (vincula Google a cuenta existente)

### Sistema de Roles y Equipo
- ✅ Tabla organization_members: id, organization_id, user_id, role, doctor_id, invited_by
- ✅ Roles: owner | staff | doctor (superadmin invisible en UI)
- ✅ Usuarios existentes migrados como owner automáticamente
- ✅ Sidebar filtra items según rol del usuario
- ✅ Badge de rol visible en sidebar (Admin / Colaborador / Médico)
- ✅ /team: panel de gestión de equipo
  - Lista de miembros con rol, email, fecha de ingreso
  - Cambiar rol desde dropdown inline
  - Eliminar miembro
  - Invitar usuario con rol (owner/staff/doctor)
  - Al invitar médico: crea registro en doctors automáticamente (nombre + especialidad)
  - Indicador ⚠️ Sin disponibilidad / ✓ Disponibilidad configurada por médico
- ✅ /api/team/invite: invita via Supabase Auth + agrega a organization_members + crea doctor
- ✅ Middleware bloqueo de rutas por rol:
  - Doctor: solo /scheduling, /doctors, /settings/integrations → redirige a /scheduling/calendar
  - Staff: bloqueado de /team, /settings/*, /admin → redirige a /dashboard
  - Doctor en /dashboard → redirige a /scheduling/calendar
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
  | Integraciones | ✅✅ | ❌❌ | ✅ solo su calendario |

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
- ✅ ⚠️ Sin disponibilidad + link "Configurar →" cuando días = —
- ✅ Rol doctor: solo su perfil, sin Nuevo médico ni Desactivar
- ✅ Disponibilidad /doctors/availability: estilo Cal.com

### CRM /crm
- ✅ Pipeline completo con 6 estados
- ✅ Vista Kanban con drag & drop
- ✅ Modal: citas vinculadas, comentarios, agendamiento interno

### Dashboard /dashboard
- ✅ Funnel + tendencia mensual + agendamiento semanal + por médico

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

---

## 🔴 PRIORIDAD 1
- [x] Eliminar médicos desde /doctors (con validación de citas activas + menú ⋯)
- [ ] Logo Ferttes: PNG transparente + subir desde /settings/general
- [ ] Verificar buffer_before/after_min con citas reales
- [ ] Arreglar autodeploy GitHub→Vercel

## 🟡 PRIORIDAD 2
- [ ] Página registro nuevo usuario anclada a planes
- [ ] Onboarding wizard post-registro
- [ ] Confirmación email con código al registrarse
- [ ] Conversaciones /conversations
- [ ] Agenda del médico: pre-seleccionar su disponibilidad en /doctors/availability

## 🟢 PRIORIDAD 3 — Superadmin
- [ ] Dashboard superadmin filtrable por cliente
- [ ] CRUD organizaciones desde /admin
- [ ] Gestión usuarios por organización
- [ ] Superadmin: puede ver config pero NO datos de pacientes

## 🔵 Fase 2
- [ ] Google Calendar bidireccional
- [ ] WhatsApp via Meta Cloud API
- [ ] Módulo historia clínica
- [ ] Motor de automatizaciones
- [ ] Stripe billing + pricing enforcement
- [ ] Reportes y analítica avanzada

---

## 📋 Detalle de lo que falta construir

### Registro + Planes (`/register`) — 🔴 P2
- Página `/register` con wizard 2 pasos: elegir plan → formulario (clínica, email, pass, teléfono)
- API `/api/register/complete`: crea organización + organization_members con rol owner
- Campo `plan` en tabla `organizations` (TEXT: free/starter/growth/scale)
- Link "Regístrate" desde `/login`
- TODO: conectar Stripe para cobro real

### Onboarding wizard — 🔴 P2
- Flujo post-registro guiado paso a paso. Sin esto el dashboard queda vacío.
- Paso 1: Datos clínica (nombre, dirección, teléfono, logo)
- Paso 2: Crear primer médico (nombre, especialidad, duración)
- Paso 3: Configurar tipo de cita (nombre, duración, modalidad, modo asignación)
- Paso 4: Configurar disponibilidad del médico (días, horas)
- Paso 5: "Tu link está listo" → muestra URL de booking + botón copiar
- Flag `onboarding_completed` en organizations para redirigir al wizard o dashboard
- Cada paso guarda en DB al avanzar, no al final (permite retomar si abandona)

### Logo upload — 🔴 P1
- Componente upload en `/settings/general` o dentro del onboarding
- Subir imagen a Supabase Storage (bucket `logos`, service role)
- Guardar URL en `organizations.logo_url`
- File → base64 con FileReader (File objects no se serializan en server actions)
- Mostrar logo en sidebar, booking público y emails

### Conversaciones `/conversations` — 🟡 P2
- UI estilo WhatsApp Web: lista de leads a la izquierda, chat a la derecha
- Tabla `messages` (lead_id, direction, content, channel, timestamp)
- Webhook n8n para recibir mensajes entrantes de WhatsApp
- Fase 2: integración directa con Meta Cloud API (sin n8n)

### Stripe billing — 🔵 Fase 2
- Checkout session al elegir plan pago en registro
- Webhook Stripe para confirmar pago → activar plan en organizations
- Portal de billing para que el owner gestione suscripción
- Enforcement de límites por plan (médicos, leads, citas/mes)
- Lógica upgrade/downgrade

### Disponibilidad (parcial) — 🟡 P2
- Pre-seleccionar disponibilidad del médico logueado en `/doctors/availability` con rol doctor
- Verificar que buffer_before_min y buffer_after_min bloquean slots con citas reales en producción

### Autodeploy GitHub→Vercel — 🔴 P1
- Conectar repo `santiagodonoso3-design/medscale-app` a Vercel
- No es código — es configuración en dashboard de Vercel: importar repo, variables de entorno, branch main
- Hoy cada deploy es manual con `npx vercel --prod`

---

## 🏗️ Decisiones Técnicas

### Arquitectura
- **Patrón:** Monolito modular (NO microservicios)
- **Frontend:** Next.js 15 con App Router
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel (repo público)

### ⚠️ Reglas críticas de código

**Next.js 15 — params es Promise:**
```typescript
const resolvedParams = await params
const slug = resolvedParams['org-slug']
```

**schedules no tiene organization_id — filtrar por doctor_id**

**appointments NO tiene appointment_type_id — no incluir en selects**

**Siempre usar createServiceClient() (service role) en server components y rutas públicas**

**contact_email de organizations NO viene del join — query separado**

**File objects no se serializan en server actions — usar base64 con FileReader**

**Upload a Storage siempre con service role**

**await en resend.emails.send() — sin await Vercel cierra la función**

**Deploy:** `npx vercel --prod` desde la carpeta del proyecto

**Cron plan Hobby:** máximo 1 vez/día, schedule "0 9 * * *"

**PowerShell con corchetes en rutas — usar -LiteralPath:**
```powershell
Get-Content -LiteralPath "app\book\[org-slug]\page.tsx"
```

**Siempre dar código completo listo para copiar — nunca pedir ajustes manuales**

**No sugerir esperar si hay solución inmediata disponible**

### Roles — Middleware
- Doctor permitido: /scheduling, /doctors, /settings/integrations, /api/google, /api/team
- Staff bloqueado: /team, /settings/general, /settings/locations, /settings/appointment-types, /settings/notifications, /admin
- Doctor en /dashboard → redirect a /scheduling/calendar

### Roles — DB
- Tabla: `organization_members` (organization_id, user_id, role, doctor_id)
- roles: 'owner' | 'staff' | 'doctor'
- Leer rol en server components: query a organization_members por user_id
- doctors.user_id es NOT NULL — siempre incluirlo al crear médico desde invite

### Google Calendar
- Tokens en `doctors.google_calendar_token` (JSONB)
- Auto-refresh cuando `expiry_date - 60000 < Date.now()`
- scheduledAt debe usar -05:00 (Bogotá), no Z (UTC)
- sendUpdates=all en el POST del evento
- GCP proyecto: medscale-app-cal-int
- Callback Supabase en GCP: https://tfqakdffusydutmzditz.supabase.co/auth/v1/callback
- Callback app en GCP: https://app.medscale.app/api/google/callback

### Google Auth (Sign in with Google)
- Callback: https://app.medscale.app/auth/callback
- Allow manual linking: habilitado en Supabase
- GCP mismo proyecto que Calendar

### Base de Datos — columnas clave
- `appointments.doctor_assignment_type` TEXT ('patient_choice' | 'auto_assigned')
- `appointment_types.rr_count_all` BOOLEAN (default true)
- `appointment_types.max_notice_days`, `buffer_before_min`, `buffer_after_min`
- `doctors.google_calendar_token` JSONB
- `doctors.user_id` TEXT NOT NULL
- `organization_members`: tabla de roles por organización

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

### Estilo de trabajo MedScale
- Prompts atómicos, un cambio a la vez
- Git push al final de cada prompt
- Verificar rutas con PowerShell antes de asumir
- Comandos PowerShell, nunca bash Unix
- Screenshots para verificar antes de seguir

### Cliente beta
- Ferttes (org_id: 4270c9b0-cbaa-4a94-bea7-508387a2529c)
- admin@ferttes.com | app.medscale.app
- 5 médicos activos, 291 leads, 234 citas históricas
