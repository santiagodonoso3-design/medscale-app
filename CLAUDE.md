# MedScale App — Estado del proyecto (9 Mayo 2026)

## ✅ Completado

### Auth y Deploy
- ✅ Login en producción (Supabase Auth)
- ✅ Variables de entorno en Vercel
- ✅ Repo público — deploys automáticos funcionando
- ✅ Middleware protección de rutas (/book/* público)
- ✅ "Olvidé mi contraseña" — flujo completo con email desde passwordreset@medscale.app
- ✅ /reset-password — página para cambiar contraseña (maneja invite + recovery flows)
- ✅ SMTP configurado en Supabase con Resend (bypasea rate limit)
- ✅ Email template reset password con logo MedScale y diseño branded

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
- ✅ /api/team/invite: invita via Supabase Auth + agrega a organization_members + crea doctor si aplica
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
- ✅ Wizard: modalidad → médico → calendario visual → formulario → confirmación
- ✅ Slots generados desde schedules de Supabase
- ✅ Round-robin de médicos con rr_count_all configurable
- ✅ max_notice_days aplicado en CalendarPicker (bloquea fechas futuras)
- ✅ buffer_before_min y buffer_after_min aplicados en isSlotBooked
- ✅ Slots ocupados bloqueados (getBookedSlots retorna {start, end}[] en Bogotá)
- ✅ Timezone fix: scheduledAt usa -05:00 en lugar de UTC

### Agenda /scheduling/calendar
- ✅ Vista dual toggle: Calendario mensual / Lista
- ✅ Lista separada en Próximas (default) / Pasadas
- ✅ Calendario mensual: navegar a meses anteriores habilitado
- ✅ Nueva cita manual: flujo 2 pasos (Paciente → Fecha y médico)
- ✅ Rol doctor: ve solo sus propias citas, sin filtro de médicos

### Módulo Doctores /doctors
- ✅ Lista de médicos con ⚠️ Sin disponibilidad + link "Configurar →" cuando días = —
- ✅ Rol doctor: ve solo su propio perfil, sin botón Nuevo médico ni Desactivar
- ✅ Disponibilidad /doctors/availability: estilo Cal.com

### CRM /crm
- ✅ Pipeline completo con 6 estados
- ✅ Vista Kanban con drag & drop
- ✅ Modal: citas vinculadas, comentarios, agendamiento interno

### Dashboard /dashboard
- ✅ Funnel: Leads → Citas totales → Asistieron → En procedimiento → Finalizados
- ✅ Tendencia mensual: BarChart 4 barras + promedio asistencia
- ✅ Agendamiento semanal: esta semana vs anterior vs promedio mes
- ✅ Por médico: Citas | Asistencias | Progreso | Paciente/Auto | Procedimientos

### Tipos de cita /settings/appointment-types
- ✅ 4 modos de asignación como radio buttons con descripción
- ✅ rr_count_all configurable por tipo
- ✅ max_notice_days, buffer_before_min, buffer_after_min en tab Reglas

### Settings /settings
- ✅ General, Sedes, Tipos de cita, Notificaciones (global), Integraciones
- ✅ Settings layout filtra tabs según rol (doctor solo ve Integraciones)

### Google Calendar Integration
- ✅ OAuth 2.0 completo por médico desde /settings/integrations
- ✅ Evento creado en Google Calendar al agendar cita (hora Bogotá correcta)
- ✅ Invitación enviada al paciente (sendUpdates=all)
- ✅ Evento eliminado al cancelar cita
- ✅ Auto-refresh de access_token
- ✅ Rol doctor: ve solo su propio calendario en Integraciones
- ✅ GCP: proyecto medscale-app-cal-int, usuario prueba fertesdigital@gmail.com

### Data Ferttes
- ✅ 291 leads con fechas reales de creación
- ✅ 156 citas históricas (Dic 2025 - Mar 2026) + 78 citas Abril 2026
- ✅ doctor_assignment_type correcto (patient_choice / auto_assigned)

### Email y notificaciones
- ✅ Resend: citas@medscale.app + passwordreset@medscale.app
- ✅ Confirmación, cancelación, reagendamiento al paciente
- ✅ Notificación interna a la clínica
- ✅ Cron recordatorios: "0 9 * * *"

---

## 🔴 PRIORIDAD 1
- [ ] Google Calendar bidireccional: evento en Google → bloquea slot en MedScale
- [ ] Verificar buffer_before/after_min con citas reales
- [ ] Logo Ferttes: PNG transparente + subir desde /settings/general
- [ ] Eliminar médicos desde /doctors (con validación de citas activas)
- [ ] Arreglar autodeploy GitHub→Vercel

## 🟡 PRIORIDAD 2
- [ ] Página registro nuevo usuario anclada a planes
- [ ] Confirmación email con código al registrarse
- [ ] Conversaciones /conversations: ver chats por lead + webhook n8n
- [ ] Middleware que bloquea rutas según rol (Sprint 3 roles)
- [ ] Agenda del médico: pre-seleccionar su disponibilidad en /doctors/availability

## 🟢 PRIORIDAD 3 — Superadmin
- [ ] Dashboard superadmin filtrable por cliente
- [ ] CRUD organizaciones desde /admin
- [ ] Gestión usuarios por organización
- [ ] Definir qué datos puede/no puede ver superadmin (acordado: no datos de pacientes)

## 🔵 Fase 2
- [ ] Google Calendar bidireccional
- [ ] WhatsApp via Meta Cloud API
- [ ] Módulo historia clínica
- [ ] Motor de automatizaciones
- [ ] Pricing enforcement
- [ ] Reportes y analítica avanzada

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

### Roles — DB
- Tabla: `organization_members` (organization_id, user_id, role, doctor_id)
- roles: 'owner' | 'staff' | 'doctor'
- Leer rol en server components: query a organization_members por user_id
- doctors.user_id es NOT NULL — siempre incluirlo al crear médico desde invite

### Google Calendar
- Tokens en `doctors.google_calendar_token` (JSONB)
- Auto-refresh cuando `expiry_date - 60000 < Date.now()`
- Rutas públicas en middleware: /api/google/callback
- GCP app en modo prueba — agregar emails como usuarios de prueba antes de conectar
- scheduledAt debe usar -05:00 (Bogotá), no Z (UTC)
- sendUpdates=all en el POST del evento para enviar invitación al paciente

### Base de Datos — columnas clave
- `appointments.doctor_assignment_type` TEXT ('patient_choice' | 'auto_assigned')
- `appointment_types.rr_count_all` BOOLEAN (default true)
- `appointment_types.max_notice_days`, `buffer_before_min`, `buffer_after_min`
- `doctors.google_calendar_token` JSONB
- `doctors.google_calendar_id` TEXT
- `doctors.google_calendar_connected_at` TIMESTAMPTZ
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
