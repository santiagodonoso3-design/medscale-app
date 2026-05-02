# MedScale App - Estado del Proyecto (2 de Mayo de 2026)

## ✅ Completado

### SESIÓN 2 (2 Mayo 2026)
- ✅ Calendario visual tipo Cal.com en /book/[org-slug]
- ✅ Slots generados desde schedules de Supabase (start_time, end_time, metadata.duration)
- ✅ Slots ocupados excluidos (query a appointments por doctor)
- ✅ Flujo completo: modalidad → médico → fecha/hora → formulario → confirmación
- ✅ Pantalla de éxito con resumen de cita y pantalla de error con retry
- ✅ ends_at calculado con metadata.duration del médico (no hardcodeado)
- ✅ Fix: schedules filtrados por doctor_id (tabla no tiene organization_id)
- ✅ Fix: middleware permite /book/* a usuarios autenticados
- ✅ Ferttes cargado como primer cliente beta (5 médicos, disponibilidades)
- ✅ external_calendar_id columna en appointments (preparado para Google Calendar)

### SESIÓN 1 (1 Mayo 2026)
- ✅ Login en producción funcionando
- ✅ Variables de entorno correctas en Vercel
- ✅ /book/[org-slug] construido con wizard de pasos
- ✅ Round-robin de médicos implementado
- ✅ Campos configurables por organización (appointment_form_fields)
- ✅ Cliente supabaseAdmin con service role para rutas públicas
- ✅ Bug de params['org-slug'] corregido

## 🚧 PENDIENTE PRÓXIMA SESIÓN
- [ ] Panel org_admin para que Ferttes entre a ver sus citas agendadas
- [ ] Quitar debug amarillo del calendario (cuadro con conteo de schedules)
- [ ] Ajustes de diseño y UX del wizard
- [ ] Google Calendar sync por médico (Fase 2)

## 🚧 PROBLEMA TÉCNICO CONOCIDO
- Vercel Hobby bloquea deploys automáticos de commits de colaboradores (medscaleai-hub vs santiagodonoso3-design)
- Solución: hacer Redeploy manual desde Vercel cada vez que Claude Code haga push, O configurar git con:
  git config user.email "email-de-vercel"
  git config user.name "santiagodonoso3-design"

## 🚧 Pendiente para MVP
- [ ] Probar flujo completo: webhook n8n → lead en CRM → cita agendada

## 🚧 Pendiente Fase 2
- Módulo de conversaciones (WA/IG/FB)
- Google Calendar sync por médico
- Dashboard ejecutivo avanzado
- Historia clínica

## 🏗️ Decisiones Técnicas

### Arquitectura
- **Patrón:** Monolito modular (NO microservicios)
- **Frontend:** Next.js 15 con App Router
- **Backend:** Supabase (PostgreSQL + Auth)
- **Base de Datos:** Schema dinámico EAV para campos de CRM por cliente
- **Agendamiento:** 100% interno en la app, sin Cal.com

### Stack Tecnológico
- **Lenguaje:** TypeScript
- **UI:** React + Tailwind CSS + shadcn/ui
- **Autenticación:** Supabase Auth
- **Base de Datos:** PostgreSQL con RLS
- **Validación:** React Hook Form + Zod
- **Deploy:** Vercel

### ⚠️ Next.js 15 — params es una Promise
En Next.js 15, los params de rutas dinámicas son async.
SIEMPRE hacer await antes de acceder:

```typescript
// ✅ Correcto
const resolvedParams = await params
const slug = resolvedParams['org-slug']

// ❌ Incorrecto — devuelve undefined
const slug = params['org-slug']
```

Aplica a TODAS las páginas con [param] en la ruta.

### ⚠️ schedules — no tiene organization_id
La tabla `schedules` no tiene `organization_id`.
Para obtener schedules de una org hay que filtrar por doctor_id:

```typescript
// ✅ Correcto
const doctorIds = doctors.map(d => d.id)
supabase.from('schedules').select(...).in('doctor_id', doctorIds)

// ❌ Incorrecto — la columna no existe
supabase.from('schedules').eq('organization_id', org.id)
```

### ⚠️ day_of_week — convención Supabase vs JavaScript
- **Supabase schedules:** 1=Lunes, 2=Martes ... 7=Domingo
- **JavaScript Date.getDay():** 0=Domingo, 1=Lunes ... 6=Sábado
- **Conversión:** `supabaseDay = jsDay === 0 ? 7 : jsDay`

### Integraciones
- **Automatización:** n8n solo envía leads de conversaciones
- **Mensajería:** WhatsApp via Meta Cloud API (investigación)
- **Webhooks:** POST `/api/webhooks/lead` para leads; no webhook de citas
- **Agenda:** sistema propio interno de disponibilidad, consultorios y médicos

## 🗂️ Estructura de Base de Datos

```
organizations (multi-tenant)
├── users (roles: superadmin, admin, staff)
├── locations
├── leads (CRM)
├── conversations
├── appointments (campo external_calendar_id para Google Calendar futuro)
├── doctors (metadata: { name, duration, default_duration })
├── schedules (doctor_id, location_id, day_of_week, start_time, end_time)
└── ... (16 tablas total)
```

## 🔐 Seguridad

- Row Level Security (RLS) en todas las tablas
- Políticas de acceso basadas en roles
- Middleware de protección de rutas (/book/* permitido sin auth)
- Guards de autenticación por componente
- One-time setup protection

## 📊 Métricas del Proyecto

- **Archivos creados:** 25+
- **Componentes:** 12+ (sidebar, layout, modals, booking-wizard, calendar-picker, etc.)
- **Server Actions:** 6+ (dashboard, organizations, setup, booking)
- **Tablas BD:** 16 con RLS completo
- **Rutas protegidas:** 10+ con middleware
- **Clientes beta:** 1 (Ferttes — 5 médicos cargados)

## 🎯 Roadmap

### Próximo (Siguiente sesión)
1. Panel org_admin — Ferttes entra a ver sus citas ← AHORA
2. Quitar debug amarillo del calendario
3. Ajustes de diseño del wizard

### MVP v0.1
- [ ] CRUD completo de organizaciones
- [x] Cliente beta con acceso al CRM (Ferttes)
- [ ] Gestión de leads básica
- [ ] Conversaciones entre usuarios
- [x] Citas agendadas internamente

### MVP v0.2
- [ ] Dashboard por organización
- [ ] Reportes y analítica
- [ ] Sistema de permisos granular
- [ ] API RESTful pública

### MVP v1.0 (Release)
- [ ] Webhooks n8n completamente integrados para leads
- [ ] WhatsApp integration
- [ ] Automaciones de CRM
- [ ] SLA y reportes avanzados

### Integraciones (Fase 2 - post primer cliente pagando)
- [ ] Panel de integraciones en /settings/integrations
- [ ] Google Calendar sync por médico
      Cada médico conecta su propio Google Calendar desde
      su perfil en /settings/doctors/[id]/calendar
      — OAuth por médico, no por organización
- [ ] Otros calendarios (Outlook, Apple Calendar)
- [ ] La tabla appointments ya tiene campo external_calendar_id preparado
