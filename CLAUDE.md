# MedScale App - Plan de Trabajo Unificado (3 Mayo 2026)

## ✅ Completado

### Auth y Deploy
- ✅ Login en producción (Supabase Auth)
- ✅ Variables de entorno en Vercel
- ✅ Repo público — deploys automáticos funcionando
- ✅ Middleware protección de rutas (/book/* público)

### Agendamiento público /book/[org-slug]
- ✅ Wizard: modalidad → médico → calendario visual → formulario → confirmación
- ✅ Slots generados desde schedules de Supabase
- ✅ Round-robin de médicos
- ✅ Campos configurables por organización (appointment_form_fields)
- ✅ ends_at calculado con metadata.duration del médico
- ✅ external_calendar_id en appointments (preparado para Google Calendar)

### Panel org_admin
- ✅ Dashboard: métricas + próximas citas + últimos leads
- ✅ Calendario /scheduling/calendar: rediseñado con tabs, vista dual y cancelación con motivo
- ✅ CRM /crm: fuentes book/manychat, búsqueda, modal lead + citas
- ✅ Wizard /book: calendario responsive en móvil (aspect-square, flex-col en mobile)

### Rediseño calendario (sesión actual)
- ✅ Tabs de navegación: Calendario | Médicos | Disponibilidad (SchedulingTabs client component)
- ✅ Vista dual toggle: [📅 Calendario] [☰ Lista]
- ✅ Vista Calendario: cuadrícula mensual con dots de color por estado, click día expande citas
- ✅ Vista Lista: agrupada por fecha, sección "Citas canceladas" atenuada al final
- ✅ Cancelación con motivo obligatorio (textarea requerida)
- ✅ Log en appointment_logs: event_type='cancelled', note=motivo, performed_by=userId
- ✅ Filtro por médico funcional + búsqueda de paciente
- ✅ Modal: email + sede + reagendar con fecha/hora separados

### Cliente beta
- ✅ Ferttes cargado (5 médicos, disponibilidades, sede)
- ✅ Usuario admin@ferttes.com creado y funcionando

## 🔴 PRIORIDAD 1 — Funcionalidades críticas (probar y corregir)
- [ ] Probar cancelar cita con motivo — verificar que guarda en appointment_logs
- [ ] Probar reagendar cita — verificar fecha/hora correcta en DB
- [ ] Probar agregar notas a cita
- [ ] Probar crear nueva cita desde panel admin
- [ ] Probar flujo completo de agendamiento público (/book) en móvil

## 🟡 PRIORIDAD 2 — UX y ajustes visuales
- [ ] Dashboard: diseño de métricas y tablas
- [ ] CRM: mejorar columnas y estados de leads
- [ ] Sidebar: navegación clara por rol (admin vs staff vs superadmin)
- [ ] Calendario: verificar que dots de colores muestran datos reales

## 🟠 PRIORIDAD 3 — Conversaciones
- [ ] Panel /conversations: ver chats por lead
- [ ] Conectar webhook n8n de ManyChat → tabla conversations
  (n8n ya está activo, solo apuntar webhook a /api/webhooks/lead)
- [ ] Vista de historial de conversación por lead
- [ ] Filtros: por agente, por estado, por fecha

## 🟢 PRIORIDAD 4 — Superadmin
- [ ] CRUD completo de organizaciones desde /admin
- [ ] Crear y gestionar usuarios por organización
- [ ] Ver métricas globales por organización
- [ ] Onboarding de nuevo cliente desde el panel

## 🔵 Fase 2 (post primer cliente pagando)
- [ ] Google Calendar sync por médico (OAuth por médico)
- [ ] Panel de integraciones /settings/integrations
- [ ] Dashboard modular personalizable por cliente
- [ ] Módulo de historia clínica
- [ ] WhatsApp integration via Meta Cloud API
- [ ] Reportes y analítica avanzada
- [ ] API RESTful pública

### Automatización de leads
- [ ] Motor de automatizaciones por organización
- [ ] Triggers: lead creado, cita agendada, cita cancelada,
      sin respuesta X días
- [ ] Acciones: enviar email, enviar WhatsApp, crear tarea,
      asignar a usuario
- [ ] Constructor visual de flujos (tipo n8n simplificado)
- [ ] Integración con n8n para ejecución de automatizaciones
- [ ] Templates de automatización por industria (clínicas)

## 🏗️ Decisiones Técnicas

### Arquitectura
- **Patrón:** Monolito modular (NO microservicios)
- **Frontend:** Next.js 15 con App Router
- **Backend:** Supabase (PostgreSQL + Auth)
- **Agendamiento:** 100% interno, sin Cal.com
- **Deploy:** Vercel (repo público)

### Stack
- TypeScript, React, Tailwind CSS, shadcn/ui
- Supabase Auth + PostgreSQL + RLS
- React Hook Form + Zod

### ⚠️ Reglas críticas de código

**Next.js 15 — params es Promise:**
```typescript
// ✅ Correcto
const resolvedParams = await params
const slug = resolvedParams['org-slug']
```

**schedules no tiene organization_id — filtrar por doctor_id:**
```typescript
const doctorIds = doctors.map(d => d.id)
supabase.from('schedules').select(...).in('doctor_id', doctorIds)
```

**day_of_week — Supabase: 1=Lunes...7=Domingo / JS: 0=Domingo...6=Sábado:**
```typescript
const supabaseDay = jsDay === 0 ? 7 : jsDay
```

### Integraciones activas
- n8n: envía leads via POST /api/webhooks/lead
- ManyChat: conversaciones via n8n (webhook pendiente de apuntar)
- Google Calendar: Fase 2

## 🗂️ Base de Datos (16 tablas)
organizations → users, locations, leads, conversations,
appointments, doctors, schedules, appointment_logs,
conversation_messages, lead_fields, lead_values,
locations_rooms, permissions, user_permissions,
superadmins, webhook_logs

## 📊 Métricas
- Archivos: 25+, Componentes: 12+, Server Actions: 6+
- Tablas BD: 16 con RLS, Clientes beta: 1 (Ferttes)
