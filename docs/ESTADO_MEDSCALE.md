# ESTADO_MEDSCALE.md

Foto viva del proyecto MedScale AI. Se actualiza semanal o cuando pasa algo material.

**Última actualización:** 3 de septiembre de 2026

---

## Producto en producción

MedScale AI es un SaaS multi-tenant de gestión médica para clínicas en Colombia y Latam. Cubre CRM, agendamiento, integración con Google Calendar, correos automáticos, facturación y agente WhatsApp (Maia).

**Clientes activos plan clínica:**
- **Grupo Ferttes** (fertilidad, Medellín) — org `4270c9b0-cbaa-4a94-bea7-508387a2529c`
- **Bariatric Latam** (Dr. Carlos Lopera) — org `f9ca61f7-49bb-4d1e-9d02-d5c77fc9bb87`, booking slug `dr-carlos-lopera/consulta-valoracion`

**Demo comercial:** Clínica Aurora Estética — org `fd9ef9af-342f-458f-94ec-4dc99898a874`, slug `clinica-aurora`

**Interno:** MedScale AI — org `883367a9-96cb-40b4-85c8-20595a89f7d7`

---

## Modelo de negocio y pricing

Tres planes:
- **Consultorio individual:** 1 médico, 1 sede. Precio bajo, entrada.
- **Clínica multi-doctor:** N médicos, N sedes. Plan actual de Ferttes y Bariatric.
- **Red de clínicas:** multi-org bajo un mismo dueño. Sin cliente aún.

Billing por Mercado Pago (COP recurrente). Stripe para expansión LatAm futura.
Detalles y valores exactos: no en repo (info comercial vive en otro sistema).

---

## Foco actual — Módulo de automatizaciones

Rediseño del módulo de automatizaciones para pasar de un motor funcional pero frágil a uno blindado, con UX vendible y capaz de escalar self-service.

### Fases cerradas esta semana

| # | Fase | Commit | Fecha |
|---|---|---|---|
| 0 | Blindaje motor CRM (idempotencia DB, `occurrence_key` determinístico, errores Resend visibles, semántica correcta) | `df65f5f` | 3 sep |
| 1 | Audiencias reales por org (endpoint `/api/lead-statuses`, validación backend, guard motor) | `a93be61` | 3 sep |
| — | Refactor URLs (helper `getAppUrl()`, 34 usos migrados en 11 archivos) | `1a05705` | 3 sep |
| 2 | Rediseño UX automatizaciones (3 secciones categorizadas, cards con estado visible, métricas 30d, modal 2 columnas con preview live, chips de variables, envío de prueba) | `5e13575` | 3 sep |
| — | Cleanup URLs final (google callback + appointment-types migrados) | `e35eba1` | 3 sep |
| — | Metodología documentada (`docs/OPERACION_MEDSCALE.md` + `docs/ESTADO_MEDSCALE.md` + `CLAUDE.md` reorganizado) | — | 3 sep |

### Próximas fases confirmadas

| # | Fase | Racional |
|---|---|---|
| — | **Template B email white-label** | Reescribir `lib/email/templates.ts`: fuentes de sistema (no Google Fonts), logo del cliente protagonista, sin marca MedScale visible al paciente, unsubscribe con mailto temporal, "Powered by MedScale AI" chico. Elimina 3 `<img src>` a logos MedScale. Arregla CTAs hardcoded a `#215F73`. |
| — | **Camino B — notificaciones read-only** | Traer los 4 correos transaccionales (`confirmation`, `reminder`, `cancellation`, `reschedule`) a `/settings/automations` como cards read-only con redirect a `/settings/notifications`. Resuelve la invisibilidad actual sin fusionar motores. |
| 2.5 | **Notificaciones editables unificadas** | Evolución de Camino B: edición completa desde `/settings/automations`. Deprecar o redirigir `/settings/notifications`. |
| 3 | **Unsubscribe legal + técnico** | Tabla `email_unsubscribes`, endpoint `/unsubscribe?token=`, motor lo respeta en marketing. Requisito legal Colombia (Habeas Data) y deliverability Gmail/Outlook. |
| 4 | **Catálogo de triggers en DB** | Tabla `automation_trigger_types` con seed. Matar `FIXED_RULE_TYPES` hardcoded en `route.ts`. Agregar tipos nuevos sin deploy. |
| 5 | **Reglas `lead_status` self-service** | Cerrar el slot "Próximamente" con UI de creación/edición. Cierra el ciclo comercial de "cliente puede configurar automatizaciones custom". |

---

## Roadmap de arquitectura (transversal a fases)

Independiente del módulo de automatizaciones. Está en progreso.

- ✅ Migrar `from('users')` → `getOrgIdFromUser()`
- ✅ `getSession()` helper creado
- ✅ Middleware simplificado
- ✅ Layout usa `getSession()`
- ⬜ Estandarizar respuestas API con `lib/api/response.ts`
- ⬜ Consolidar dual gate superadmin (`platform_admins` + `SUPERADMIN_EMAILS` env)
- ⬜ Extender `requireOrgContext()` para retornar `permissions`; migrar `team.ts` e `importLeads.ts` a `canEdit()`
- ⬜ Migrar consumidores restantes de `schedules` al resolver unificado `lib/availability/resolve.ts`

---

## Deuda técnica anotada

### Bugs latentes

- `toDBDay` retorna 7 para domingo en `ManageAppointmentClient.tsx` (DB CHECK `day_of_week` es 0-6). Rompe display de slots domingo.
- `getGoogleCalendarBusy` catchea todo con `return []` → fail-open. Google no disponible = indistinguible de disponibilidad real.
- 4 ghost events pendientes en Ferttes Google Calendar (comunicados a clínica para borrado manual). Cron de reconciliación no construido.
- 2-min lag en creación de eventos Google Calendar.
- Doctor role ve UI de cancel/reschedule (debería ocultarse).
- `/team` no captura nombres reales en invitación.
- Regla `lead_status` de test en Ferttes invisible en UI pero sigue disparándose. Decisión pendiente: pausar, borrar, o esperar Fase 5.
- Bariatric: catálogo de procedimientos con nombres genéricos ("Procedimiento"). Faltan reales de Lopera.
- POST `/api/automations` fuerza `is_active: true` — no permite crear pausada.
- `manage/route.ts:101` permite rescheduling a días bloqueados.
- `/api/book/route.ts:330` tiene fail-open explícito en check de disponibilidad Google Calendar.
- Phone format inconsistencia entre `/api/webhooks/lead` y conversations webhook → puede dejar `lead_id = null` al arribo del mensaje.
- `appointment_logs.performed_by` recibió `'patient'` como string en algún punto histórico (fixed pero logs viejos incompletos).

### Deuda estructural

- `changed_by` es NULL en 100% de `lead_status_history` — no hay atribución de quién cambió qué.
- `modality` en `appointment_types` sin CHECK constraint. Drift entre `presencial`/`in_person` por org.
- `schema_migrations` con 3 rows vs historia completa en repo → `supabase db push` sería destructivo.
- `importLeads.ts` trusts `orgId` del cliente (gap de seguridad menor).
- `booking-client.tsx` es dead code (schema mismatch, no lo renderiza nadie).
- Aurora demo tiene `created_at` en diciembre 2026 → rompe queries "últimos 30 días" durante demos.
- Consumidores de `schedules` no migrados todos al resolver unificado `lib/availability/resolve.ts`.
- Dual gate superadmin (`platform_admins` + `SUPERADMIN_EMAILS` env) — consolidar.
- Middleware convention deprecada en Next 16 (warning al arrancar).
- 3 `<img src="app.medscale.app/logo-*.png">` en `templates.ts` — se resuelven en Template B.
- Clientes existentes con plan manual (Ferttes, Bariatric) no deben ser tocados por el flujo Mercado Pago self-service.
- Flujo Mercado Pago self-service construido pero no validado end-to-end con pago real.
- Cloned appointment type queda activo en Bariatric como public booking link ya no necesario.

---

## Verificaciones pendientes

- **Nivel 2 visual del rediseño UX Fase 2** — screenshot del modal con preview cargado en producción (Ferttes). Vista general ya confirmada.
- **Login local funcional** — Supabase Redirect URLs debe incluir `http://localhost:3000/**`. Sin probar aún que `npm run dev` + login vuelve a localhost tras el refactor.

---

## Decisiones tomadas recientes (para no reabrir)

- **No unificar motor transaccional + CRM** en Fase 0. Sistemas conviven, capa de logs compartida vía `automation_logs`. Unificación es problema de Fase 2.5+.
- **`AUDIENCE_OPTIONS` dinámico por org** desde `lead_statuses`. Reservadas: `all`, `birthday`, `noshow`. Cualquier otro valor debe ser un `lead_statuses.key` activo.
- **Template A → Template B** cerrado en concepto. Fuentes de sistema, white-label puro, logo del cliente domina, "Powered by MedScale AI" en footer chico, mailto como unsubscribe temporal.
- **Refactor URLs completo** con `getAppUrl()`. Solo 4 hits restantes de `app.medscale.app` — 1 en helper, 3 en logos MedScale del template A (mueren en Template B).
- **CRON_SECRET rotado** el 3 sep tras exposición accidental en chat.
- **Reglas `lead_status` no editables por UI hasta Fase 5.** La regla existente de Ferttes sigue funcional en motor.
- **Metodología antes que features nuevas** (3 sep) — Camino A adoptado, docs `OPERACION_MEDSCALE.md` + `ESTADO_MEDSCALE.md` + `CLAUDE.md` reorganizado.
- **Cadencia realista**: diaria + semanal + al cerrar fase. Cadencias mensual/trimestral omitidas.
- **`schema_migrations` desincronizado con repo**: nunca correr `supabase db push`. Aplicar migrations por MCP.

---

## Herramientas y accesos

- **Supabase MCP:** proyecto `tfqakdffusydutmzditz`. Acceso directo desde chat de diagnóstico.
- **Resend:** transaccional desde `citas@medscale.app` y `passwordreset@medscale.app`. SPF y DKIM verificados. **DMARC pendiente** (causa delivery a spam en Hotmail/Outlook).
- **n8n:** webhooks WhatsApp/Instagram/Facebook → `/api/conversations/webhook`. Rotado.
- **Mercado Pago:** suscripciones COP recurrentes. Webhook con HMAC-SHA256.
- **Google Cloud Console:** proyecto `medscale-app-cal-int` (816952703187). OAuth verificado (aprobado 3 sep).
- **Vercel:** plan Hobby. `CRON_SECRET` (rotado), `SUPERADMIN_EMAILS`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MP_ACCESS_TOKEN`, `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_APP_URL`. Autodeploy `main`.
- **Claude Code:** ejecutor de cambios de archivos. Verificación post-commit obligatoria.
- **Windows Credential Manager:** entrada `orbitscalehq-git` da problemas recurrentes → resuelto embebiendo user en URL remota.

---

## Cadencia

- **Diaria** (5 min): revisar este archivo, ver reportes de Ferttes/Bariatric, confirmar en DB si algo cambió.
- **Semanal** (30 min): actualizar fases cerradas, deuda técnica, decisiones. Escribir número real de correos enviados si aplica.
- **Al cerrar cada fase**: actualizar entrada en tabla de fases cerradas con commit hash y fecha.

Cadencias mensual/trimestral del OPERACION plantilla están omitidas — se activarán si aparece detonante (contratar dev, cerrar cliente enterprise, etc.).
