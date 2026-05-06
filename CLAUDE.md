# MedScale App — Estado del proyecto (6 Mayo 2026)

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
- ✅ Cancelación con motivo obligatorio (textarea requerida)
- ✅ Log en appointment_logs: event_type='cancelled', note=motivo, performed_by=userId
- ✅ Reagendar cita: fecha + hora separados
- ✅ Notas editables por cita
- ✅ Nueva cita manual: modal con búsqueda de lead o creación nueva
- ✅ Filtro por médico + búsqueda de paciente
- ✅ Vista lista por defecto (no calendario)
- ✅ Toggle Lista/Calendario prominente a la izquierda junto a los filtros (pill bg-slate-900)
- ✅ Vista lista: pills de rango Hoy / Esta semana / Este mes / Todos (default: Esta semana)
- ✅ Vista lista: separadores de fecha en bg-blue-50, texto blue-700 bold
- ✅ Vista lista: canceladas en su fecha original, borde izquierdo rojo (border-l-4 border-red-400) + nombre tachado
- ✅ Vista lista: "Sin nombre" en canceladas → "Paciente no disponible" gris itálico
- ✅ Vista lista: toggle "Mostrar canceladas" (default ON) — solo visual, no afecta métricas
- ✅ Vista lista: header de columnas único arriba (no repetido por grupo de fecha)
- ✅ Vista lista: columna Modalidad eliminada

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
- ✅ Estados del pipeline: contactado → cita_valoracion_agendada → asistio_cita → cancelo_cita → en_tratamiento_medico → finalizado
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
- ✅ Crear lead manual: fuente default 'manual', estado inicial 'contactado'

### Sidebar y navegación
- ✅ 7 items: Dashboard, CRM, Agenda, Conversaciones, Doctores, Equipo, Configuración
- ✅ Agenda activo en cualquier ruta /scheduling/*
- ✅ /team placeholder "Próximamente — gestión de equipo y roles"
- ✅ /scheduling redirige a /scheduling/calendar

### Booking Form (/book/[org-slug]/[tipo-slug])
- ✅ i18n completo: wizard en español e inglés (TRANSLATIONS object, t.* keys reactivos al idioma)
- ✅ min_notice_hours aplicado en CalendarPicker (bloquea días y slots dentro del aviso mínimo)
- ✅ Round robin proporcional funcionando: asigna médico con menos citas del mes que tenga el slot disponible
- ✅ Bug middleware corregido: /api/book ya no redirige a /dashboard en sesiones autenticadas
- ✅ Nombre y apellido separados: contact_last_name agregado a leads, booking form usa patient_first_name + patient_last_name

### Tipos de cita (/scheduling/appointment-types)
- ✅ Modal expandido con 3 tabs verticales: General, Reglas, Formulario
- ✅ Tab Reglas: min_notice_hours, max_notice_days, buffer_before_min, buffer_after_min
- ✅ Tab Formulario: campos configurables por tipo de cita con drag & drop para reordenar
- ✅ Campos base (Nombre, Teléfono, Email, Cédula) visibles como no editables
- ✅ Tabla appointment_form_fields creada y conectada al booking wizard

### Email y notificaciones
- ✅ Resend integrado: dominio medscale.app verificado, emails desde citas@medscale.app
- ✅ Email confirmación al paciente: bilingüe es/en, brand kit MedScale aplicado
- ✅ Email cancelación al paciente: se dispara desde cancelAppointment() en actions.ts
- ✅ Email reagendamiento al paciente: se dispara desde rescheduleAppointment() en actions.ts
- ✅ Notificaciones configurables por tipo de cita: tabla appointment_type_notifications, tab Notificaciones en modal
- ✅ Precio informativo en booking form y email de confirmación
- ✅ lib/email/resend.ts, lib/email/templates.ts (bookingConfirmationPatient, cancellationEmail, rescheduleEmail)
- ✅ RESEND_API_KEY en Vercel Environment Variables (Production)
- ✅ Envío no-bloqueante con Promise.allSettled

### Calendario
- ✅ Reagendamiento con CalendarPicker real (respeta schedules del médico)
- ✅ Modal se expande a max-w-2xl cuando reagendamiento está abierto
- ✅ Modal se cierra automáticamente después de reagendar
- ✅ Tabs Calendario/Tipos de cita rediseñados como pills prominentes

### CRM y datos
- ✅ Nombre completo en tabla CRM: contact_name + contact_last_name en una línea
- ✅ Modal de cita mejorado: reagendar colapsado por defecto, botones de acción más limpios
- ✅ Precio visible en tabla de tipos de cita
- ✅ Campos base visibles en tab Formulario como no editables

### Cliente beta
- ✅ Ferttes cargado (5 médicos, disponibilidades, sede)
- ✅ Usuario admin@ferttes.com creado y funcionando

### Brand Kit y Visual
- ✅ Brand kit aplicado en sidebar (bg-foreground, tokens CSS)
- ✅ Booking wizard rediseñado: nueva jerarquía step 1, cards de modalidad, "Primer médico disponible" como opción principal, médicos siempre visibles
- ✅ Idioma eliminado del booking wizard (hardcodeado es-CO)
- ✅ Responsive booking wizard móvil (flex-col en móvil, grid-cols-1 médicos, panel lateral oculto)
- ✅ /settings/general: CRUD de nombre, color primario y logo por organización
- ✅ Logo subido a Supabase Storage (bucket: organizations, público)
- ✅ Upload via server action con base64 + service role
- ✅ Color primario aplicado en booking wizard (24 referencias a B.primary reemplazadas)
- ✅ Logo renderizado en header del booking wizard cuando logo_url existe

### Settings
- ✅ /settings con tabs: General, Sedes, Tipos de cita, Notificaciones
- ✅ /settings/locations: CRUD completo de sedes (nombre + dirección + activa/inactiva)
- ✅ Tipos de cita movido de /scheduling a /settings/appointment-types (redirect en /scheduling)
- ✅ Migración: ALTER TABLE locations ADD COLUMN address TEXT

### Booking y Leads
- ✅ Leads desde /book llegan con status 'cita_valoracion_agendada' (fix en /api/book/route.ts)
- ✅ Email de notificación interna a la clínica: se dispara al crear cita desde /api/book, usa contact_email de organizations
- ✅ Reglas de display step 1 según configuración:
  - Modalidad fija + 1 médico → salta step 1 completo
  - Modalidad fija + 2+ médicos → solo grid de médicos
  - patient_choice + 1 médico → solo toggle modalidad
  - patient_choice + 2+ médicos → modalidad + médicos
- ✅ Step indicator muestra 2 pasos cuando skipStep1=true
- ✅ Auto-asignar médico cuando solo hay 1 asignado al tipo

### Gestión de citas desde email
- ✅ manage_token en tabla appointments (UUID único por cita)
- ✅ /appointment/[token]/manage — página pública sin login
  - Muestra detalles: médico, fecha, hora, modalidad, sede con dirección
  - Reagendar: CalendarPicker con schedules del médico
  - Cancelar: textarea con motivo requerido
  - Pantalla de éxito con check SVG limpio
- ✅ /api/appointment/manage PATCH handler (reschedule + cancel + logs + emails)
- ✅ Email confirmación incluye botones "Reagendar cita" y "Cancelar cita" con manageUrl
- ✅ Middleware: /appointment y /api/appointment y /api/cron en PUBLIC_ROUTES

### Dominio y emails
- ✅ Dominio app.medscale.app configurado en Vercel + GoDaddy (CNAME)
- ✅ manageUrl apunta a https://app.medscale.app/appointment/[token]/manage
- ✅ Email notificación clínica al crear cita: bookingNotificationClinic() en /api/book
- ✅ Email paciente y clínica al reagendar desde /appointment/[token]/manage
- ✅ Email paciente y clínica al cancelar desde /appointment/[token]/manage
- ✅ Query separado para contact_email de organizations en manage route

### Cron de recordatorios
- ✅ /api/cron/reminders — cron job funcionando ({"sent":0} confirmado)
- ✅ vercel.json: schedule "0 9 * * *" (9am UTC = 4am Bogotá, plan Hobby)
- ✅ Migración: ALTER TABLE appointments ADD COLUMN reminder_sent_at TIMESTAMPTZ
- ✅ CRON_SECRET=medscale-cron-2026 en Vercel Environment Variables
- ✅ Lógica: lee appointment_type_notifications donde event_type='reminder' y enabled=true, envía email y marca reminder_sent_at

---

## 🐛 Bugs conocidos (corregir próxima sesión)
- ✅ CRM: estados legacy normalizados en carga (STATUS_NORMALIZE cubre inglés y español pre-migración)
- ✅ CRM: pipeline muestra conteos correctos tras normalización
- ✅ Migración 008: nuevo→contactado, en_procedimiento→en_tratamiento_medico, perdido→cancelo_cita
- ✅ CRM: fuentes legacy manychat/manychat_n8n → whatsapp (migración 005 + normalización en carga)

## 🔴 PRIORIDAD 1 — Probar y corregir en producción
- ✅ /appointment/[token]/manage
- ✅ Cron job recordatorios
- ✅ Rediseño brand kit booking wizard
- ✅ Status leads desde /book → cita_valoracion_agendada
- ✅ Conectar dirección de sede al booking wizard paso 1 (cuando modalidad=presencial, mostrar dirección)
- ✅ Booking wizard responsive: verificar en 375px, 390px, 414px
- ✅ Verificar cancelar cita con motivo guarda correctamente en appointment_logs
- ✅ Verificar reagendar cita — fecha/hora correcta en DB
- ✅ Email de notificación a la clínica (requiere contact_email en organizations)
- ✅ Configurar app.medscale.app en Vercel + GoDaddy
- ✅ Actualizar manageUrl a https://app.medscale.app
- ✅ Verificar botones "Reagendar" y "Cancelar" del email al paciente
- [ ] Arreglar autodeploy GitHub→Vercel (webhook roto, usar npx vercel --prod mientras)
- [ ] Tipos de cita: test_type 'valoracion-express' y 'consulta-flexible' creados
- ✅ Logo y color personalizable por cliente (logo_url, primary_color en organizations)
- [ ] Logo Ferttes: conseguir PNG con fondo transparente y subir desde /settings/general
- [ ] Aplicar max_notice_days y buffer_before/after_min en el booking wizard
- [ ] Verificar nueva cita manual desde panel admin
- [ ] Dashboard: revisar métricas y mejorar UX de tarjetas

## 🟡 PRIORIDAD 2 — UX y ajustes
- [ ] Sidebar: diferenciación visual por rol (admin vs staff vs superadmin)
- [ ] Conversaciones /conversations: ver chats por lead
- [ ] Conectar webhook n8n de ManyChat → tabla conversations
- [ ] Login: agregar link "Olvidé mi contraseña" con forgot password flow de Supabase Auth
- [ ] Login: agregar link "Crear cuenta" o flujo de onboarding para nuevos usuarios
- [ ] Settings > Notificaciones: campo para configurar emails de notificación internos de la clínica (a quién llega el email cuando entra una cita nueva, se reagenda o cancela). Default: contact_email de organizations. Puede ser múltiple (ej: admin + recepción + médico). Tabla sugerida: organization_notification_emails o campo JSON en organizations.

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
- [ ] Vincular procedimiento al lead cuando status = en_tratamiento_medico
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

### Email
- Proveedor: Resend — plan free, 3000 emails/mes
- Dominio: medscale.app (GoDaddy, auto-configurado por Resend)
- From: citas@medscale.app
- Templates: lib/email/templates.ts
- Cliente singleton: lib/email/resend.ts
- Email notificación clínica: bookingNotificationClinic() en templates.ts, se dispara desde /api/book al crear cita
- manage route: usa query separado a organizations para contact_email (join de Supabase no devuelve columnas agregadas post-creación de tabla)
- Emails en manage route usan await para evitar que Vercel cierre la función antes de que Resend complete

### Notificaciones
- manage_token: UUID único por cita para URLs públicas seguras sin login
- Email templates: brandShell() función helper para consistencia visual entre templates
- appointment_type_notifications: upsert on conflict `appointment_type_id,event_type`

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

**/api/book es ruta pública:**
- Ya está en `PUBLIC_ROUTES` en middleware.ts
- Excluida del redirect de usuarios autenticados (`!pathname.startsWith('/api/')`)
- No agregar auth checks aquí — es la ruta de agendamiento externo

**appointment_form_fields — siempre filtrar:**
```typescript
.eq('appointment_type_id', id).eq('active', true).order('sort_order')
```

**Nombres de leads:**
- `contact_name` = primer nombre
- `contact_last_name` = apellido (columna nueva, nullable)
- Mostrar: `${contact_name}${contact_last_name ? ' ' + contact_last_name : ''}`

**Deploy:** autodeploy GitHub→Vercel puede romperse. Usar `npx vercel --prod` desde la carpeta del proyecto como alternativa confiable.

**Cron Vercel plan Hobby:** máximo 1 vez al día. Schedule actual: "0 9 * * *". Para crons más frecuentes usar cron-job.org o upgrade a Pro.

**organizations — select siempre incluir contact_email:**
```typescript
.select('id, name, contact_email')
```
Necesario para disparar el email de notificación a la clínica desde /api/book.

**manage route — siempre await en resend.emails.send():**
Sin `await`, Vercel cierra la función antes de que el email salga. Aplicar en todos los envíos de manage route.

**contact_email de organizations NO viene del join:**
```typescript
const { data: orgData } = await admin
  .from('organizations')
  .select('contact_email')
  .eq('id', apt.organization_id)
  .single()
```

**Excepciones en schedules:**
- `is_recurring=true`  → horario semanal recurrente (day_of_week set, specific_date null)
- `is_recurring=false` → excepción de fecha específica (specific_date set, day_of_week null)
  - `active=true`  → día adicional con horario
  - `active=false` → día bloqueado sin atención

### Storage
- Bucket: organizations (público) en Supabase Storage
- Upload: server action uploadOrgLogo() en app/actions/settings.ts
- Ruta: logos/{orgId}.{ext} con upsert: true
- File objects no se serializan en server actions — usar base64 + FileReader en cliente

### Integraciones activas
- n8n: envía leads via POST /api/webhooks/lead
- ManyChat: conversaciones via n8n (webhook pendiente de apuntar)
- Google Calendar: Fase 2

## 🗂️ Base de Datos (16 tablas + columna específica)
organizations → id, name, slug, metadata, contact_email, created_at, updated_at
organizations → users, locations, leads, conversations,
appointments, doctors, schedules (+ specific_date DATE), appointment_logs,
conversation_messages, lead_fields, lead_values,
locations_rooms, permissions, user_permissions,
superadmins, webhook_logs

## Pendientes

### Tipos de cita — features pendientes
- [ ] Idioma por médico (granular filtering): hoy el filtro de idioma muestra todos los médicos asignados; en el futuro cada médico tendrá su propio array de idiomas y el wizard solo mostrará los que hablen el idioma seleccionado

### Dashboard — mejoras pendientes
- [ ] Filtros de año/mes (chips) no quedaron al 100% — revisar y completar
- [ ] Agregar más métricas al funnel visual (% conversión entre pasos)
- [ ] Selector de año en gráfica debe re-fetch data desde Supabase, no solo filtrar client-side
- [ ] Validar que filtro global afecte correctamente funnel + gráfica + tabla médicos
- [ ] "Citas de hoy" debe ignorar filtros siempre

## Arquitectura /settings

### Rutas
- `/settings/general`            → nombre clínica, logo, colores primarios
- `/settings/locations`          → CRUD sedes (nombre + dirección)
- `/settings/appointment-types`  → tipos de cita (movido desde /scheduling)
- `/settings/notifications`      → recordatorios por tipo de cita (appointment_type_notifications)

### Reglas de navegación
- **Doctores** = módulo independiente en sidebar (complejidad operativa diaria)
- **Configuración** = se toca una vez: General, Sedes, Tipos de cita, Notificaciones
- **Tipos de cita NO van en /scheduling** — van en /settings/appointment-types

### Sedes
- Migración pendiente: `ALTER TABLE locations ADD COLUMN IF NOT EXISTS address TEXT`
- 1 sede en booking → muestra dirección directamente
- 2+ sedes en booking → dropdown para elegir sede
- Sede se muestra solo cuando modalidad = presencial

### Step 1 booking wizard — reglas de display
| Condición | Qué se muestra |
|---|---|
| Modalidad fija + 1 médico | Salta step 1 completo |
| Modalidad fija + 2+ médicos | Solo grid de médicos |
| patient_choice + 1 médico | Solo toggle presencial/virtual |
| patient_choice + 2+ médicos | Toggle presencial/virtual + grid de médicos |

## Módulo: Tipos de Cita + Booking Form

### Arquitectura definida

**Tipos de cita** son configurables por cliente (multi-tenant). Cada tipo tiene:
- Nombre
- Duración (min)
- Modo de asignación:
  - `one_on_one` → paciente escoge médico
  - `round_robin_proportional` → asigna médico con menos citas del mes que tenga el slot libre
  - `round_robin_availability` → asigna primer médico disponible
  - `hybrid` → paciente puede escoger médico o dejar que el sistema asigne
- Médicos asignados (array de doctor_ids)
- Aviso mínimo (horas)
- Link público (auto-generado desde el nombre)
- Activo: sí/no

### Regla de asignación Round Robin proporcional
1. Filtrar médicos asignados al tipo que tengan el slot disponible (según schedules)
2. De esos, escoger el que tenga menos citas en el mes actual
3. Empate → el que tenga menos citas en los últimos 7 días
4. Asignar y confirmar

### Flujo del Booking Form (vista paciente — máximo 4 pasos)

**Paso 1** — Escoge tipo de cita (cards)
**Paso 2** — Preferencia de médico (SOLO si modo = hybrid Y médicos asignados >= 2)
  - Si modo = one_on_one → va directo a escoger médico (sin pregunta)
  - Si modo = round_robin_* → se salta este paso completamente
  - Si médicos asignados = 1 → se salta este paso, se usa ese médico
**Paso 3** — Escoge fecha y hora (solo slots disponibles)
**Paso 4** — Datos del paciente (nombre, teléfono, email)
**Confirmación** — muestra médico asignado

### Plan de construcción (en orden)
- [ ] Paso 1: Construir UI de tipos de cita en /scheduling/appointment-types (CRUD completo)
- [ ] Paso 2: Crear tabla appointment_types en Supabase si no existe
- [ ] Paso 3: Conectar booking form /book/[org-slug] para que consuma tipos de cita
- [ ] Paso 4: Implementar lógica de asignación round robin en server action
- [ ] Paso 5: Adaptar booking form para renderizar según configuración del tipo de cita

### Pendiente antes de Paso 1
- Revisar si appointment_types ya existe en Supabase
- Revisar cómo funciona actualmente /book/[org-slug]

## Estrategia de Pricing

### Modelo: Por clínica (org), cobro mensual en USD

| Plan | Precio/mes | Límites | Módulos incluidos |
|---|---|---|---|
| Free | $0 | 1 médico, 50 leads, 20 citas/mes | Solo CRM básico |
| Starter | $29 USD | 3 médicos, leads ilimitados, 100 citas/mes | CRM + Agenda + Booking |
| Growth | $79 USD | 8 médicos, todo ilimitado | Todo + Conversaciones + Reportes |
| Scale | $149 USD | Médicos ilimitados | Todo + Multiubicación + API |

### Reglas de enforcement (pendiente de implementar)
- [ ] Campo `plan` en tabla `organizations` (free | starter | growth | scale)
- [ ] Middleware que valide límites por plan antes de crear leads, citas, médicos
- [ ] UI que muestre upgrade prompt cuando se alcanza un límite
- [ ] Ferttes está en plan Growth (cliente beta, acceso completo sin restricciones)

### Decisiones tomadas
- Cobro por clínica, no por seat (evita fricción cultural en Colombia)
- Moneda: USD
- Mercado actual: Solo Colombia (próximos 6 meses)
- Free engancha con límites reales que se sienten rápido (50 leads = ~2 semanas en clínica activa)

## 📊 Métricas
- Archivos: 35+, Componentes: 18+, Server Actions: 6+
- Tablas BD: 16 con RLS, Clientes beta: 1 (Ferttes)
- Rutas: /dashboard, /crm, /scheduling/calendar, /doctors, /doctors/availability, /team, /settings
