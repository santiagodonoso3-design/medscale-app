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
- ✅ Calendario /scheduling/calendar: modal con cancelar, notas, reagendar
- ✅ CRM /crm: fuentes book/manychat, búsqueda, modal lead + citas

### Cliente beta
- ✅ Ferttes cargado (5 médicos, disponibilidades, sede)
- ✅ Usuario admin@ferttes.com creado y funcionando

## 🔴 PRIORIDAD 1 — Funcionalidades críticas (probar y corregir)
- [ ] Cancelar cita desde calendario — probar que funciona
- [ ] Reagendar cita — probar que funciona
- [ ] Agregar notas a cita — probar que funciona
- [ ] Crear nueva cita desde panel admin
- [ ] Ver detalle de lead con sus citas
- [ ] Filtros de calendario por médico

## 🟡 PRIORIDAD 2 — UX y ajustes visuales
- [ ] Dashboard: mejorar diseño de métricas y tablas
- [ ] Calendario: mejorar vista general
- [ ] CRM: mejorar columnas y estados de leads
- [ ] Wizard /book: ajustes finales de diseño
- [ ] Sidebar: navegación clara por rol (admin vs staff vs superadmin)

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
