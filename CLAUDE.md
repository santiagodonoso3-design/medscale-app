# MedScale App — Estado del proyecto (3 Mayo 2026)

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
- ✅ Calendario responsive en móvil (aspect-square, flex-col)

### Agenda /scheduling/calendar
- ✅ Vista dual toggle: Calendario mensual / Lista agrupada por fecha
- ✅ Tabs pill: Calendario | (Médicos y Disponibilidad movidos a /doctors)
- ✅ Calendario mensual: chips de texto en desktop (hora + nombre), dots en móvil
- ✅ Citas canceladas visualmente separadas y atenuadas en vista lista
- ✅ Cancelación con motivo obligatorio (textarea requerida)
- ✅ Log en appointment_logs: event_type='cancelled', note=motivo, performed_by=userId
- ✅ Reagendar cita: fecha + hora separados
- ✅ Notas editables por cita
- ✅ Nueva cita manual: modal con búsqueda de lead o creación nueva
- ✅ Filtro por médico + búsqueda de paciente

### Módulo Doctores /doctors
- ✅ Lista de médicos: tabla con Nombre (dot color), Especialidad, Duración, Días que atiende, Estado
- ✅ Nuevo médico y Editar médico: modal (no formulario inline)
- ✅ Duración desde metadata.default_duration
- ✅ Días que atiende: computed desde schedules filtrados por doctor_id
- ✅ Activar/Desactivar médico desde tabla
- ✅ Disponibilidad /doctors/availability: estilo Cal.com
  - Toggle por día (Lun–Dom), hora inicio–fin en la misma fila
  - Dropdown médico + sede en la parte superior
  - Guardar: DELETE is_recurring=true + INSERT días activos (preserva excepciones)
- ✅ Días adicionales: fecha específica + horario (active=true, is_recurring=false)
- ✅ Días bloqueados: fecha específica sin atención (active=false, is_recurring=false)
- ✅ Migración 003: columna specific_date DATE en tabla schedules

### CRM /crm
- ✅ Estados del pipeline: nuevo → contactado → agendado → en_procedimiento → finalizado → perdido
- ✅ Pipeline clicable: clic en tarjeta filtra la tabla, color de acento por etapa
- ✅ Fuentes actualizadas: instagram, whatsapp, facebook, web, book, referido, manual (legacy manychat → whatsapp)
- ✅ contact_cedula en leads (migración 006)
- ✅ Dropdown inline en columna Estado — actualiza Supabase sin abrir modal
- ✅ Dropdown inline en columna Fuente — mismo patrón que Estado
- ✅ Ordenar tabla por columna: Nombre, Estado, Creado, Actualizado
- ✅ Columnas adicionales: Cédula, Citas (badge azul), Creado, Actualizado, Notas (truncada 40 chars)
- ✅ Vista Kanban toggle: columnas por estado, cards arrastrables con drag & drop
- ✅ Modal completo: nombre, cédula, teléfono, email, fuente, estado, notas, fechas
- ✅ Modal: tabla de citas vinculadas (fecha, médico, estado)
- ✅ Modal: sección de comentarios con autor + tiempo relativo (tabla lead_comments, migración 007)
- ✅ Modal: agendamiento interno — selector médico + calendario visual + slots (sin salir del CRM)
- ✅ Toast de éxito al guardar lead y al agendar cita; modal se cierra automáticamente
- ✅ Crear lead manual: fuente default 'manual', estado inicial 'nuevo'

### Sidebar y navegación
- ✅ 7 items: Dashboard, CRM, Agenda, Conversaciones, Doctores, Equipo, Configuración
- ✅ Agenda activo en cualquier ruta /scheduling/*
- ✅ /team placeholder "Próximamente — gestión de equipo y roles"
- ✅ /scheduling redirige a /scheduling/calendar

### Cliente beta
- ✅ Ferttes cargado (5 médicos, disponibilidades, sede)
- ✅ Usuario admin@ferttes.com creado y funcionando

---

## 🐛 Bugs conocidos (corregir próxima sesión)
- ✅ CRM: estados legacy normalizados en carga (STATUS_NORMALIZE: new→nuevo, contacted→contactado, etc.)
- ✅ CRM: pipeline muestra conteos correctos tras normalización
- ✅ CRM: fuentes legacy manychat/manychat_n8n → whatsapp (migración 005 + normalización en carga)

## 🔴 PRIORIDAD 1 — Probar y corregir en producción
- [ ] Verificar cancelar cita con motivo guarda correctamente en appointment_logs
- [ ] Verificar reagendar cita — fecha/hora correcta en DB
- [ ] Verificar nueva cita manual desde panel admin
- [ ] Probar flujo completo de agendamiento público (/book) en móvil
- [ ] Dashboard: revisar métricas y mejorar UX de tarjetas
- [ ] Sección "Tipos de cita" en /settings o /scheduling:
  - Crear tipos de reunión (ej: Consulta inicial, Seguimiento, Procedimiento, Virtual)
  - Cada tipo tiene: nombre, duración, color, modalidad (presencial/virtual), precio opcional
  - Generar link público por tipo: /book/[org-slug]/[tipo-slug]
  - Vista de todos los links generados para compartir
  - El wizard /book usa el tipo para preconfigurar duración y modalidad

## 🟡 PRIORIDAD 2 — UX y ajustes
- [ ] Sidebar: diferenciación visual por rol (admin vs staff vs superadmin)
- [ ] Conversaciones /conversations: ver chats por lead
- [ ] Conectar webhook n8n de ManyChat → tabla conversations

## 🟢 PRIORIDAD 3 — Superadmin
- [ ] CRUD completo de organizaciones desde /admin
- [ ] Crear y gestionar usuarios por organización
- [ ] Ver métricas globales por organización

## 🔵 Fase 2 (post primer cliente pagando)
- [ ] Google Calendar sync por médico (OAuth por médico)
- [ ] Panel de integraciones /settings/integrations
- [ ] Dashboard modular personalizable por cliente
- [ ] Módulo de historia clínica
- [ ] WhatsApp integration via Meta Cloud API
- [ ] Reportes y analítica avanzada
- [ ] API RESTful pública
- [ ] Tabla de procedimientos médicos por organización
- [ ] Vincular procedimiento al lead cuando status = en_procedimiento
- [ ] Motor de automatizaciones: triggers (lead creado, cita agendada, sin respuesta)
  → acciones: enviar email, WhatsApp, crear tarea, asignar usuario
- [ ] Constructor visual de flujos + integración n8n
- [ ] CRM multi-fuente: captura desde formularios web, emails y encuestas
- [ ] Tracking unificado de conversaciones por lead (todos los canales en una vista)
- [ ] Automatizaciones basadas en cambios de estado del lead

---

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

**day_of_week — el check constraint real de la DB es 0-6 (igual que JS):**
```
0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles,
4 = Jueves,  5 = Viernes, 6 = Sábado
```
El availability-editor usa esta escala directamente. No hacer conversión.

**Excepciones en schedules:**
- `is_recurring=true`  → horario semanal recurrente (day_of_week set, specific_date null)
- `is_recurring=false` → excepción de fecha específica (specific_date set, day_of_week null)
  - `active=true`  → día adicional con horario
  - `active=false` → día bloqueado sin atención

### Integraciones activas
- n8n: envía leads via POST /api/webhooks/lead
- ManyChat: conversaciones via n8n (webhook pendiente de apuntar)
- Google Calendar: Fase 2

## 🗂️ Base de Datos (16 tablas + columna específica)
organizations → users, locations, leads, conversations,
appointments, doctors, schedules (+ specific_date DATE), appointment_logs,
conversation_messages, lead_fields, lead_values,
locations_rooms, permissions, user_permissions,
superadmins, webhook_logs

## 📊 Métricas
- Archivos: 35+, Componentes: 18+, Server Actions: 6+
- Tablas BD: 16 con RLS, Clientes beta: 1 (Ferttes)
- Rutas: /dashboard, /crm, /scheduling/calendar, /doctors, /doctors/availability, /team, /settings
