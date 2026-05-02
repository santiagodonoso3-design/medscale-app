# MedScale App - Estado del Proyecto (1 de Mayo de 2026)

## ✅ Completado

### RESUELTO HOY
- ✅ Login en producción funcionando
- ✅ Variables de entorno correctas en Vercel
- ✅ /book/[org-slug] construido con wizard de pasos
- ✅ Round-robin de médicos implementado
- ✅ Campos configurables por organización (appointment_form_fields)
- ✅ Cliente supabaseAdmin con service role para rutas públicas
- ✅ Bug de params['org-slug'] corregido
- ✅ /book/[org-slug] funcionando en producción y localhost

## 🚧 PENDIENTE VERIFICAR
- [ ] Cargar médicos y disponibilidad del cliente beta
- [ ] Probar flujo completo de agendamiento
- [ ] PENDIENTE: ajustes de diseño y UX del wizard de agendamiento

## 🚧 PROBLEMA TÉCNICO CONOCIDO
- Vercel Hobby bloquea deploys automáticos de commits de colaboradores (medscaleai-hub vs santiagodonoso3-design)
- Solución: hacer Redeploy manual desde Vercel cada vez que Claude Code haga push, O configurar git con:
  git config user.email "email-de-vercel"
  git config user.name "santiagodonoso3-design"

## 🚧 Pendiente para MVP
- [ ] Probar flujo completo: webhook n8n → lead en CRM → cita agendada

## 🚧 Pendiente Fase 2
- Módulo de conversaciones (WA/IG/FB)
- Google Calendar sync
- Dashboard ejecutivo avanzado
- Historia clínica

## 🏗️ Decisiones Técnicas

### Arquitectura
- **Patrón:** Monolito modular (NO microservicios)
- **Frontend:** Next.js 14 con App Router
- **Backend:** Supabase (PostgreSQL + Auth)
- **Base de Datos:** Schema dinámico EAV para campos de CRM por cliente
- **Agendamiento:** 100% interno en la app, sin Cal.com

### Stack Tecnológico
- **Lenguaje:** TypeScript
- **UI:** React + Tailwind CSS + shadcn/ui
- **Autenticación:** Supabase Auth
- **Base de Datos:** PostgreSQL con RLS
- **Validación:** React Hook Form + Zod
- **Deploy:** Vercel (cuando MVP funcional)

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
Revisar que todas las páginas existentes usen await params.

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
├── appointments
├── doctors
├── schedules
└── ... (16 tablas total)
```

## 🔐 Seguridad

- Row Level Security (RLS) en todas las tablas
- Políticas de acceso basadas en roles
- Middleware de protección de rutas
- Guards de autenticación por componente
- One-time setup protection

## 📊 Métricas del Proyecto

- **Archivos creados:** 20+
- **Componentes:** 10+ (sidebar, layout, modals, etc.)
- **Server Actions:** 5+ (dashboard, organizations, setup)
- **Tablas BD:** 16 con RLS completo
- **Rutas protegidas:** 10+ con middleware

## 🎯 Roadmap Futuro

### Módulos pendientes en orden
1. Webhook de leads (n8n → CRM) ← AHORA
2. Panel org_admin (cliente entra a su cuenta)
3. Sistema de agendamiento interno
4. Deploy en Vercel

### MVP v0.1 (Siguiente)
- [ ] CRUD completo de organizaciones
- [ ] Cliente beta con acceso al CRM
- [ ] Gestión de leads básica
- [ ] Conversaciones entre usuarios
- [ ] Citas agendadas internamente

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
- [ ] Google Calendar sync (appointments ↔ gcal)
- [ ] Integración Google Calendar por médico (Fase 2)
      Cada médico conecta su propio Google Calendar desde
      su perfil en /settings/doctors/[id]/calendar
      — OAuth por médico, no por organización
- [ ] Otros calendarios (Outlook, Apple Calendar)
- [ ] La tabla appointments ya tiene campo external_calendar_id 
      preparado para esto

### Nota técnica
- El agendamiento /book/[org-slug] guarda citas en Supabase
- external_calendar_id queda null hasta que se active la integración
- Round-robin de médicos implementado desde el inicio

Próxima sesión: cargar datos reales del cliente beta
(médicos, disponibilidad, sedes) y probar flujo completo
de agendamiento end-to-end.
