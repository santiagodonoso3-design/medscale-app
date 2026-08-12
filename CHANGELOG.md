# MedScale App — Historial de cambios
> Registro cronológico de sesiones. Para reglas y estado actual ver CLAUDE.md.

---

### Sesión 6-8 Junio 2026 — Auditoría de limpieza + desmantelamiento de esquema legacy + demo

#### Contexto
Auditoría exhaustiva enfocada en código limpio y coherencia de datos. Eje: separar capa invariante (reglas iguales para todo tenant) de capa configurable (variables por cliente). Resultado: cero clientes hardcodeados, multi-tenancy verificado consistente, esquema legacy completo eliminado.

#### Campos custom unificados (booking → CRM)
- CRM ahora lee de la vista `crm_fields` (NO de `org_custom_fields` directo). La vista une campos del booking (`appointment_form_fields`, source='form') + campos manuales del CRM (`org_custom_fields` source='crm'). Defines en el tipo de cita → aparece en CRM solo, para todo cliente. Eliminado el espejo manual por SQL.
- `crm-client.tsx` y `exportLeads.ts` migrados a leer de `crm_fields`.
- Limpiados los `source='form'` muertos en `org_custom_fields` (espejos viejos). `tipo-identificacion` de Ferttes salvado a source='crm' antes del DELETE (era huérfano, solo existía en org_custom_fields).
- `crm_fields` migrada a WITH (security_invoker = true) — fix del linter de Supabase (CRITICAL). Antes la vista corría como SECURITY DEFINER y podía saltarse el RLS de aislamiento por tenant. Ahora respeta el RLS del usuario (get_user_org_id).

#### Esquema legacy desmantelado
- Dropeadas 9 tablas legacy (vacías, sin escritores vivos, verificadas por las 5 vías): `users`, `superadmins`, `lead_fields`, `lead_values`, `conversations`, `conversation_messages`, `permissions`, `user_permissions`, `locations_rooms`.
- Dropeadas funciones huérfanas `has_permission`, `has_role` (leían tablas legacy, no usadas en policies).
- Identidad = `auth.users` + `organization_members`. Custom fields = `leads.metadata` + `org_custom_fields`. Mensajes = `messages`. NO recrear tablas legacy.

#### Incidente y fix — is_superadmin
- Dropear `superadmins` tumbó /doctors en ambos clientes: la función `is_superadmin()` la consultaba y el grep de código TypeScript no la detectó (vivía en la DB).
- Fix: `is_superadmin()` repuntada de `superadmins` a `platform_admins`. Las ~30 RLS policies que la usan volvieron a evaluar bien.
- LECCIÓN: antes de dropear cualquier tabla, barrer las 5 vías — código, FKs, funciones (information_schema.routines), policies (pg_policies), triggers. Migrar el consumidor ANTES de dropear, nunca después.

#### appointment_logs — logging de cancelaciones arreglado de raíz
- Bug: 174 cancelaciones históricas, 0 registros en appointment_logs. Doble causa: FK performed_by apuntaba a tabla legacy `users` (13 de 16 user IDs de auth.users no existían ahí, FK rechazaba el insert) Y el código metía el string 'patient' en una columna uuid (feedback/route.ts:37, manage/route.ts:129).
- Fix: FK performed_by repuntada a auth.users con ON DELETE SET NULL. Verificado: cancelación de prueba ahora registra. Histórico perdido no recuperable.

#### Webhook de leads reescrito
- `/api/webhooks/lead` escribía custom_fields a tablas legacy (lead_fields/lead_values, vacías, nunca usadas). Reescrito para guardar en `leads.metadata` (modelo v2). Confirmado: ningún flujo n8n lo usaba (solo /api/conversations/webhook está activo).

#### Limpieza de rutas y código muerto
- `/scheduling/availability` y `/scheduling/doctors` → redirects a /doctors/availability y /doctors (eran duplicados de la migración). /scheduling/doctors además no validaba permisos (agujero de seguridad cerrado).
- /setup eliminada (código muerto: createFirstSuperadmin autodeshabilitado, escribía a users legacy).
- app/actions/settings.ts: getOrgSettings consolidado al helper createClient() (eliminadas ~15 líneas duplicadas).
- scheduling-tabs.tsx: reducido a solo el tab Calendario.

#### Guardrails (anti-acumulación de basura)
- Nueva sección "Reglas de auditoría" en CLAUDE.md con las lecciones aprendidas.
- Script check-rules.ps1 en la raíz: verifica patrones prohibidos (await createServiceClient, clientes hardcodeados) antes de pushear. Correr con .\check-rules.ps1
- Pendientes anotados con trigger en sección "Deuda técnica diferida": escala birthday/special_date (>5k leads), knip para huérfanos, ESLint duro.

#### Demo — Clínica Aurora Estética
- Org demo creada (org_id: [demo, ver CONTEXT.local.md], slug: clinica-aurora, plan clinica, metadata is_demo=true).
- Owner demo: demo@medscale.app. 2 médicos, 2 tipos de cita con 3 campos custom, 5 procedimientos.
- Data del año generada por SQL: ~213 leads, ~179 citas, ~100 procedimientos. Curva de ingresos en sierra ascendente (~30M/mes promedio, ene 18M → jun 42M).
- Script de rejuvenecer (empuja todas las fechas de Aurora +N días) para mantener el demo fresco todo el año. Correr las 3 sentencias por separado cuando el calendario se vea viejo.

#### LECCIONES técnicas clave
- Editor de Supabase: NUNCA correr BEGIN/COMMIT con múltiples sentencias — no persiste confiable (un SELECT dentro de la transacción mostró data que el COMMIT no guardó). Correr sentencias solas.
- Dashboard de Next.js cachea: tras insertar data, recargar duro (Ctrl+Shift+R) o no se ven los cambios.
- procedure_price es snapshot: subir precios en el catálogo NO actualiza procedimientos ya registrados.

---

### Sesión 6 Junio 2026 — Refactor anclaje de procedimientos en dashboard

#### Contexto
Bariatric: los procedimientos no caían en el mes correcto en "Tendencia mensual" ni aparecían en el embudo. Causa raíz: tres lugares anclaban procedimientos a fuentes distintas (status del lead, fecha de cita, performed_at). Auditoría completa y unificación a una sola fuente: lead_procedures.performed_at.

#### Cita manual Bariatric (Cal viejo)
- Insertada cita de Johana Escobar (Dr. Lopera, 10-jun 8:30am virtual) que el Cal viejo no sincronizó a MedScale. Lead + appointment vía CTE, match por cédula. Timezone -05 verificado.
- Confirmado: doctor_assignment_type CHECK solo acepta 'patient_choice' | 'auto_assigned' (no 'manual').

#### Bulk update de status — leads Bariatric (Opción B: recalcular por asistencia)
- ~77 leads actualizados por cédula desde PDF exportado del CRM. Regla: fecha pasada → asistio_cita; fecha futura → cita_valoracion_agendada; sin fecha → cancelo_cita; con procedimiento → en_tratamiento_medico.
- "Asistió a cita" sin fecha se respetó (no se mandó a cancelo). 2 leads con cédula duplicada (1036931081) excluidos para manejo manual.
- 5 procedimientos de mayo registrados en lead_procedures con performed_at=2026-05-01.

#### Fix 1 — Display de fecha de procedimiento (crm-client.tsx)
- Bug: performed_at (tipo date) se formateaba con fmtDate (timezone Bogotá) → "2026-05-01" mostraba "30 abr" (retroceso de 1 día por conversión UTC→UTC-5).
- Fix: nueva fmtDateOnly parsea YYYY-MM-DD como fecha local literal (new Date(y, mo-1, d)), sin timezone. fmtDate intacta para timestamptz reales.

#### Fix 2 — Tendencia mensual cuenta procedimientos por performed_at (dashboard-client.tsx)
- Bug: serie "procedimiento" contaba yearLeads por status, ignorando performed_at → procedimientos en mes equivocado, mayo en 0.
- Fix: cuenta desde procedureLeads por procedure_month, alineado con "Ingresos por mes".

#### Refactor — eliminar serie "Finalizados" (Opción B)
- "Finalizados" y "Procedimiento" medían lo mismo con fechas distintas (status finalizado vs performed_at), generando incoherencia. Eliminada la serie Finalizados del gráfico y su tipo en interface Metrics. Desenlace del lead sigue en el embudo.

#### Refactor — Embudo alineado con Tendencia mensual
- "Llegó a tratamiento" ahora cuenta leads únicos con procedimiento en procedure_month (antes: por leads.status, daba 0 en filtro mensual).
- Paso "Finalizó" eliminado (3 pasos). Porcentajes calculados sobre "Agendó" (no sobre paso anterior), por mezcla de cohortes. Verificado: mayo muestra Agendó 27 · Asistió 9 · Tratamiento 5, cuadra con la barra.

#### Hallazgos de auditoría (deuda abierta)
- 7 procedimientos viejos sin performed_at: caen por cascada en mes de la cita, no del procedimiento. Backfillear si se requiere precisión.
- 18 citas de mayo en status 'scheduled' sin cerrar (ya pasadas): la clínica no marca completed/no_show post-cita. Subcuenta asistencia e ingresos. Problema de proceso o falta flujo de cierre de citas.
- Fuga de Cal viejo SIGUE ABIERTA: agendamientos por Cal no entran a MedScale (sin lead, sin cita, sin email/automatización). Solución pendiente: endpoint POST /api/webhooks/cal que n8n invoque, dedup por external_calendar_id=bookingId.

---

### Sesión 3 Junio 2026

#### CRM — Export a Excel (gated Growth+)
- Nueva server action exportLeads.ts: genera .xlsx vía librería xlsx (SheetJS, agregada a deps)
- Gating server-side: orgId de getSession() (nunca del cliente) + organizations.plan; solo growth/scale pasan
- Respeta filtros activos del CRM (status/source/search + metadata); etiquetas legibles (STATUS_PIPELINE, SOURCE_LABELS, field_label)
- Botón "Exportar" siempre visible (upsell): habilitado Growth/Scale, deshabilitado con tooltip en planes inferiores

#### CRM — Filtros por columna estilo Airtable
- Reemplazados dropdowns sueltos de Estado/Fuente por menú-por-columna (clic en header → popover orden + filtro por tipo: text/enum/number/date)
- Filtros acumulables (columnFilters) aplicados en useMemo filteredLeads (client-side); indicador de filtro activo + "Limpiar filtros"
- Pipeline pills conservadas como atajo, aplican con AND

#### Dashboard — Selector de período (presets)
- Reemplazados botones sueltos de año+meses por segmented: "Este mes"/"Mes pasado"/"Trimestre"/"Año" + "⋯" (Personalizado: multi-select de meses + año, meses futuros deshabilitados)
- Presets traducidos a selectedMonths[]+selectedYear (sin tocar actions.ts ni computeMetrics)
- Cambio de año dispara refetch; cambio de meses dentro del año es client-side. Caso borde: "Mes pasado" en enero → dic año anterior

#### Limpieza de status de leads (DB — Bariatric)
- Migrados valores sucios a canónicos: asistio_a_cita (2) → asistio_cita, scheduled (1) → cita_valoracion_agendada (UPDATE transaccional)
- Verificado: ninguna otra org tenía valores legacy. Resultado Bariatric: agendada 46, asistió 34, canceló 22, tratamiento 7
- Canónico de "asistió" = asistio_cita (sin _a_). DEUDA: no hay normalización en la escritura

#### Dashboard — "Leads por estado" → Embudo de conversión
- Reemplazado por funnel sobre appointments (eventos reales), unidad = leads únicos, monotonía forzada
- 4 etapas en cascada: Agendó (≥1 cita) → Asistió (≥1 completed) → Llegó a tratamiento (status en_tratamiento_medico OR finalizado) → Finalizó (status finalizado)
- Anclado al universo base (leads con cita en período). Muestra número + % del paso + % del total. Filtrado por período (meses recientes = cohorte inmadura; leer en Año/Trimestre)
- interface Metrics: leadsByStatus → conversionFunnel. Eliminadas STAGE_ORDER/STAGE_INDEX/HIDDEN_STATUSES

#### Datos de clientes (snapshot 3 jun 2026)
- Ferttes: 330 leads, 317 citas, 16 procedimientos, 5 médicos, plan Growth
- Bariatric Latam: ~108 leads, 100 citas, 1 médico, plan Growth
- Clinica Lab 2: ELIMINADA

#### Deuda técnica abierta (anotada esta sesión)
- importLeads.ts recibe orgId por PARÁMETRO del cliente (hueco multi-tenant) — migrar a getSession(). exportLeads.ts ya lo hace bien
- Normalización de status en la escritura (cada entrada puede meter valores no canónicos)
- CRM filtros/orden client-side (escala hasta ~1-2k leads/org)
- Módulo automatizaciones sin cron de ejecución (reglas se guardan, no se disparan)
- Billing MP en prod sin pago real validado

---

### Sesión 2 Junio 2026 — Parte 2: Migración Ferttes + fixes formulario/dashboard

#### Migración completa de Ferttes (data real reemplaza histórica de Airtable)
- Borrada toda la data transaccional vieja de Ferttes (leads + citas + dependientes), estructura conservada
- **330 leads** cargados (326 del CRM + 4 creados desde citas sin match)
- **317 citas** ancladas por teléfono normalizado (últimos 10 dígitos, sin prefijo 57)
- **16 procedimientos** asignados a leads (FIV, Criopreservación, Inseminación, Otro $0)
- source = canal de marketing donde existía (instagram_facebook/referido/google_web/voz_a_voz), 'import' donde no
- created_at de citas anclado al created_at del lead (vía UPDATE con JOIN)
- doctor_assignment_type derivado del nombre del servicio: si incluye nombre de médico → patient_choice, si genérico → auto_assigned (93 patient_choice / 224 auto)

#### Formulario de agendamiento Ferttes (2 tipos de cita activos)
- Tipos reales ahora: **Consulta Médica** (presencial) y **Asesoría Virtual** (virtual), cada uno con formulario de 9 campos custom
- Tipos viejos "Consulta Inicial" e "Internacional" quedaron activos pero EN DESUSO — pendiente desactivar
- Campos custom del form (appointment_form_fields): fecha-de-nacimiento, lugar-de-nacimiento, ciudad, estado-civil, profesion, direccion, eps, tipo-vinculacion, tipo-sangre
- Procedimientos catálogo: FIV 1 ciclo $26.200.000, Criopreservación $9.000.000, Inseminación $2.900.000, Otro procedimiento $0

#### Tipo + Número de Identificación (campos nativos del wizard)
- Wizard booking: agregado "Tipo de Identificación" (select nativo: CC, CE, Pasaporte, TI, RC) ENCIMA de "Número de Identificación" (renombrado de "Cédula"). Tipo se guarda en custom_fields['tipo-identificacion'] → metadata. Número sigue en contact_cedula.
- BASE_FIELDS de settings/appointment-types: sincronizado a Nombre/Teléfono/Email/Tipo de Identificación/Número de Identificación
- CRM: columna "Cédula" → "Núm. Identificación" (header) y "Número de Identificación" (modal label)
- Modal detalle de cita (calendar-client-fixed): muestra Número de Identificación leyendo contact_cedula, pareado con Tipo de Identificación

#### Sincronización campos formulario en CRM
- CRM lee columnas dinámicas de org_custom_fields (source IN 'form'|'crm'|'both'), NO de appointment_form_fields
- Para que el CRM muestre los campos del booking, hay que ESPEJAR los campos en org_custom_fields con source='form'
- Los 10 campos de Ferttes insertados en org_custom_fields (incluye tipo-identificacion)

#### Modal detalle de cita — Respuestas del formulario en 2 columnas
- Sección "Respuestas del formulario" muestra metadata mapeado contra appointment_form_fields por appointment_type_id (respeta form por clínica)
- Layout 2 columnas (textarea ocupa col-span-2)
- Fallback "Sin respuestas de formulario" para data migrada sin metadata

#### Dashboard — columna Procedimientos arreglada
- ANTES: columna "Procedimientos" contaba leads con status 'en_tratamiento_medico' (incorrecto)
- AHORA: cuenta procedureLeads reales (leads con procedure_id) atribuidos por última cita del lead (cualquier status, vía lastAnyDoctorByLead)
- Atribución de ingreso de procedimiento alineada a la misma lógica (lastAnyDoctorByLead) para consistencia ingreso↔conteo
- Caso de borde: procedimientos en leads SIN ninguna cita no se atribuyen a médico (cuentan en ingreso global pero no por médico)

#### Bug crítico de migración — fechas día/mes invertidas
- 24 citas quedaron con scheduled_at invertido (ej. "2 jun" guardado como "6 feb")
- CAUSA: el datetime de Excel (col1) tenía día↔mes invertido por localización; debí usar col3 (texto "11 May 2026") como fuente de verdad
- Corregido con UPDATE match por teléfono + fecha incorrecta actual
- Junio pasó de 9 a 27 citas (correcto)

#### Ferttes — datos actualizados
- org_id: [Ferttes, ver CONTEXT.local.md] | plan Growth
- 5 médicos: Dra. Juliana Tamayo, Dra. Laura Mendoza, Dr. Germán Raigosa, Dr. Felipe Velez, Dra. Andrea Vasquez
- 330 leads, 317 citas, 16 procedimientos (data real, NO migrada de Airtable)
- 2 tipos de cita activos: Consulta Médica (presencial), Asesoría Virtual (virtual)

---

### Billing MP — Producción lista (2 Junio 2026)
- ✅ Credenciales de producción activadas (MP_ACCESS_TOKEN prod en Vercel)
- ✅ 3 planes recreados en producción (IDs distintos a los de prueba, en MP_PLAN_* de Vercel)
- ✅ Webhook configurado en Modo productivo (MP_WEBHOOK_SECRET actualizado a secret de prod)
- ✅ Webhook usa MP_ACCESS_TOKEN (prod), no _TEST
- ✅ Página /billing/success creada (server component, fuera de grupo (app), sin DB)
- ⏳ Sin probar pago real end-to-end (decisión: no gastar plata; primer cliente real será la prueba)
- Estrategia cobro: clientes actuales → manual (link de pago MP); clientes nuevos → autoservicio
- Pendiente: simular webhook en modo productivo para confirmar firma prod responde 200
- Pendiente menor: middleware.ts deprecado en Next.js 16 → migrar a proxy (futuro)

---

### Sesión 2 Junio 2026

#### Billing — Mercado Pago Suscripciones

**Modelo:** cobro recurrente plataforma → clínica. Cuenta MP persona natural (User ID real 80169027). Checkout hosted vía init_point del preapproval_plan (NO se crea preapproval desde backend — eso exige card_token_id/PCI). MP captura tarjeta, crea suscripción, notifica por webhook.

**Flujo:**
1. `/settings/billing` (owner-only) → botón "Cambiar a X"
2. POST `/api/billing/subscribe` { tier } → construye init_point del plan + external_reference=orgId → devuelve URL
3. Cliente paga en MP (hosted)
4. Webhook `/api/webhooks/mercadopago` → valida firma x-signature → re-consulta MP → actualiza plan

**Webhook — claves técnicas:**
- data.id viene en QUERY PARAMS de la URL, no en el body
- manifest firma: `id:{dataId};request-id:{xRequestId};ts:{ts};` → HMAC-SHA256 con MP_WEBHOOK_SECRET → comparar vs v1
- Idempotencia: subscription_events.mp_event_id = `{dataId}-{status}` (UNIQUE). Renovaciones mensuales se ignoran como duplicado (OK para MVP, revisar si se quiere histórico de cobros)
- Status: authorized→plan+status, paused→solo status, cancelled→free. Si tier no matchea: NO toca plan, solo loguea
- SIEMPRE 200 salvo firma inválida (401) y error DB (500) — MP reintenta agresivo

**Planes pagos = objetos en MP. Free = estado solo en DB (sin ID MP).**

**Precios COP:** Starter $119k / Growth $319k / Scale $599k

**Env vars (valores en Vercel):** MP_ACCESS_TOKEN_TEST, MP_PLAN_STARTER/GROWTH/SCALE, MP_WEBHOOK_SECRET. NO confundir MP_WEBHOOK_SECRET (firma MP) con WEBHOOK_SECRET (n8n, header x-webhook-secret).

**Sandbox MP:** no se pudo completar pago end-to-end porque el plan pertenece a cuenta real y el comprador es de prueba (mezcla de entornos, error "fatal"). Validado: checkout carga, firma webhook responde 200 (simulación oficial). Prueba real se hará en producción.

**Pendiente producción:** MP_ACCESS_TOKEN prod + recrear planes con token prod (IDs distintos) + webhook Modo productivo (otro secret) + página /billing/success.

---

### Sesión 1 Junio 2026

#### Módulo Automatizaciones
- ✅ `/settings/automations`: UI de gestión de reglas (cards agrupadas por tipo, modal de edición)
- ✅ Tab "Automatizaciones" agregado al sidebar de settings (visible owner + staff)
- ✅ API `/api/automations`: GET, POST, PATCH, DELETE — filtrado por organization_id, service role
- ✅ 6 rule_types soportados: followup_post_cita, noshow_recovery, procedure_followup, procedure_completed, birthday, special_date
- ✅ Reglas fijas (una por org): followup_post_cita, noshow_recovery, procedure_followup, procedure_completed, birthday
- ✅ Reglas múltiples: special_date (Día de madres, Navidad, fechas custom, etc.)
- ✅ Modal con variables de template: {{nombre}}, {{nombre_clinica}}, {{nombre_doctor}}
- ✅ Toggle activo/inactivo en card y en modal de edición
- ✅ DELETE solo para special_date (reglas fijas no se pueden eliminar, solo desactivar)
- ⏳ Cron de ejecución de reglas — pendiente próximo prompt

---

### Sesión 27 Mayo 2026 — Parte 2

#### Dashboard rediseño completo
- ✅ KPI cards: Ingresos estimados (citas + procedimientos), Citas del período, Tasa de asistencia, Leads nuevos
- ✅ Ingresos = solo appointments con status completed × price
- ✅ Tasa asistencia = completed / (completed + no_show + cancelled), excluye scheduled
- ✅ Tendencia mensual: barras azules (agendadas), verdes (asistencias), moradas (finalizados), naranjas (procedimiento)
- ✅ Procedimientos y finalizados anclados a scheduled_at de última cita completed del lead (no created_at del lead)
- ✅ Ingresos por mes: bar chart stacked (verde=citas, violeta=procedimientos) con labels compactos (4.5M, 350K)
- ✅ Leads por estado: barras horizontales con distribución del período
- ✅ Actividad de citas: heatmap compacto últimos 30 días + métricas (semana, progreso mes, vs mes anterior)
- ✅ Agendamientos por día: bar chart últimos 14 días por created_at (no scheduled_at)
- ✅ Tabla por médico: columna Ingresos agregada (SUM price WHERE completed + procedimientos)
- ✅ Razones de cancelación y no-show al final (desde appointments.metadata.cancellation_reason)

#### Procedimientos
- ✅ Tabla `procedures`: id, organization_id, name, price, is_active
- ✅ CRUD en /settings/procedures con cards UI
- ✅ API /api/procedures: GET, POST, PATCH, DELETE — filtrado por organization_id, service role
- ✅ CRM: dropdown "Procedimiento realizado" cuando lead status = en_tratamiento_medico
- ✅ `leads.procedure_id` y `leads.procedure_price` guardan snapshot del procedimiento asignado
- ✅ Dashboard: ingresos totales = citas completed + procedimientos. Chart stacked bar.

#### Appointments — columnas nuevas
- ✅ `appointment_type_id` UUID FK → appointment_types (guardar siempre al crear)
- ✅ `modality` TEXT ('presencial' | 'virtual')
- ✅ `price` INTEGER (precio COP al momento de crear la cita — snapshot)
- ✅ Booking público y cita manual guardan los 3 campos
- ✅ Backfill Bariatric Latam: todas las citas con price = 350000

#### Permisos actualizados
- ✅ Staff en /dashboard → redirect a /crm (no tiene acceso)
- ✅ /team readOnly para staff (ve lista, no puede invitar/editar/eliminar)
- ✅ /settings accesible para staff (todas las secciones)

#### Sistema de referidos
- ✅ Tabla `referral_codes`: CRUD completo desde superadmin `/admin/referrals`
- ✅ Tabla `referral_uses`: registro de uso por organización
- ✅ `organizations.referral_code_id`: FK al código usado en el registro
- ✅ API `/api/referrals`: GET/POST/PATCH — superadmin only (verifica SUPERADMIN_EMAILS)
- ✅ API `/api/referrals/validate?code=XXX`: endpoint público — valida código activo, no expirado, con cupo
- ✅ `/register`: campo opcional "Código de referido" con validación en tiempo real (debounce 500ms)
- ✅ Badge verde "Descuento de X% aplicado · Referido por [nombre]" si código válido
- ✅ `/api/register/complete`: re-valida server-side, guarda `referral_code_id`, inserta en `referral_uses`, incrementa `times_used`
- ✅ `/api/referrals/validate` excluido del middleware (ruta pública)

#### Backfills
- ✅ `appointments.created_at` corregido con fechas reales del CRM de Bariatric (99 registros)
- ✅ `appointments.doctor_assignment_type` = patient_choice para todas las citas de Bariatric

---

### Cliente Bariatric Latam (27 Mayo 2026)
- org_id: [Bariatric, ver CONTEXT.local.md]
- slug: dr-carlos-lopera
- [email owner, ver CONTEXT.local.md]
- 1 médico (Dr. Carlos Lopera), Google Calendar conectado
- 100 leads, 100 citas, plan Growth

---

### Sesión 27 Mayo 2026

#### Fixes y mejoras de booking
- ✅ Fix RLS appointment_types: policy migrada de public.users a get_user_org_id()
- ✅ Error amigable cuando slug de appointment_type duplicado
- ✅ Duración correcta en booking: usa appointment_type.duration_minutes, no doctor metadata
- ✅ Duración correcta en Google Calendar events (mismo fix)
- ✅ Texto dinámico de pago en booking: presencial="Se paga en el consultorio", virtual="Te enviaremos los detalles por email"
- ✅ Precios por modalidad: price_presencial y price_virtual en appointment_types (reemplaza price)

#### Disponibilidad y calendario
- ✅ Múltiples bloques horarios por día en disponibilidad de doctores
- ✅ Google Calendar FreeBusy: booking público bloquea slots ocupados del calendario del doctor
- ✅ Selección de calendario Google: si el doctor tiene múltiples calendarios, puede elegir cuál usar
- ✅ google_calendar_id se guarda al elegir, google_calendars temporal en metadata

#### CRM dinámico
- ✅ Tabla org_custom_fields: campos custom por organización (field_name, field_label, field_type, options, source)
- ✅ Custom fields se guardan en leads.metadata (JSONB) en vez de leads.notes
- ✅ CRM muestra columnas dinámicas desde org_custom_fields
- ✅ Botón "+" estilo Airtable para agregar campos desde el CRM
- ✅ Campos editables en modal de detalle del lead
- ✅ Búsqueda incluye valores de metadata
- ✅ Campo tipo "select" (dropdown) con opciones custom en formularios de agendamiento
- ✅ Options incluido en query de form fields para booking

#### Emails y notificaciones
- ✅ Fix: await en email a clínica (Vercel cerraba función antes de enviar)
- ✅ Múltiples destinatarios: contact_email soporta emails separados por coma
- ✅ Fix guardado de notification emails via API route (RLS bloqueaba update directo)
- ✅ Campos custom con labels legibles en email de notificación a clínica
- ✅ Cédula incluida en email a clínica
- ✅ Email de invitación branded via Resend (reemplaza email genérico de Supabase)
- ✅ Email de no_show: "¿No pudiste asistir?" con botón feedback + reagendar
- ✅ Email de cancelación mejorado: agregados botones feedback + reagendar
- ✅ Página de feedback: /appointment/[token]/feedback con razones predefinidas
- ✅ API /api/appointment/feedback: guarda razón en appointments.metadata.cancellation_reason

#### UX y diseño
- ✅ Tipos de cita: rediseño de tabla a cards (grid responsivo)
- ✅ Eliminar tipo de cita desde modal de edición (zona de peligro)
- ✅ Toggle ojo en campos de contraseña (login + reset-password)
- ✅ Términos y condiciones: checkbox en register, texto informativo en login, modal con contenido legal
- ✅ Logo MedScale en login, register, reset-password y emails
- ✅ Sidebar: solo muestra logo de la org (sin logo MedScale, branding correcto para SaaS)
- ✅ Favicon MS AI en formato PNG RGBA
- ✅ Integraciones visible en sidebar para rol doctor
- ✅ No_show agregado al dropdown rápido de estado en lista de citas

#### Superadmin
- ✅ Soft delete de orgs: 24h gracia + email de aviso al owner + cron de limpieza
- ✅ Acciones de desactivar/eliminar movidas dentro del modal de editar org

#### Migración datos
- ✅ Bariatric Latam: 99 leads + 99 citas migradas desde Airtable/Excel
- ✅ Metadata (entidad, fecha_nacimiento) migrada correctamente

#### Integraciones
- ✅ n8n webhook conectado para WhatsApp e Instagram de Bariatric Latam

#### Auth y CRM
- ✅ Estados custom del CRM: lead_statuses por organización
- ✅ Google OAuth en registro crea organización correctamente

---

## ✅ Completado

### Auth y Deploy
- ✅ Login en producción (Supabase Auth)
- ✅ Sign in with Google — OAuth 2.0 con vinculación de cuentas por email
- ✅ /auth/callback — maneja redirect de Google OAuth
- ✅ Variables de entorno en Vercel
- ✅ Middleware simplificado (solo auth, sin queries de rol)
- ✅ "Olvidé mi contraseña" — flujo completo con email desde passwordreset@medscale.app
- ✅ /reset-password — maneja invite + recovery flows (Suspense boundary)
- ✅ SMTP configurado en Supabase con Resend (bypasea rate limit)
- ✅ Email template reset password con logo MedScale y diseño branded
- ✅ Allow manual linking habilitado en Supabase (vincula Google a cuenta existente)
- ✅ Autodeploy GitHub→Vercel configurado

### Arquitectura (13 Mayo 2026)
- ✅ `getSession()` helper centralizado en `lib/auth/session.ts`
- ✅ Migración `from('users')` → `getOrgIdFromUser`/`getSession` en 14+ archivos
- ✅ `createServiceClient()` usa `@supabase/supabase-js` (service role real, bypasea RLS)
- ✅ `get_user_org_id()` SQL function apunta a `organization_members`
- ✅ Todas las RLS policies migradas a `get_user_org_id()`
- ✅ Foreign key `doctors.user_id` → `auth.users` (no `public.users`)
- ✅ Middleware simplificado: 0 queries a DB, solo verifica sesión
- ✅ Layout usa `getSession()`
- ✅ Dashboard filtra por `organization_id`
- ✅ Doctors page filtra por `organization_id`
- ✅ Limpieza: eliminados `guards.ts`, `layout/header.tsx`, `layout/sidebar.tsx`, `api/dev/`, `console.logs`
- ✅ Enforcement de límites por plan (`lib/plans.ts` + `checkPlanLimit`)
- ✅ API `/api/doctors/route.ts` con service role (reemplaza insert directo desde client)
- ✅ API `/api/plans/check/route.ts` para checks desde client components
- ✅ Superadmin: planes actualizados a free/starter/growth/scale con límites
- ✅ Logo upload bucket `'logos'` en Supabase Storage (público)
- ✅ `uploadOrgLogo` migrado a `createServiceClient()` y bucket `'logos'`

### Sistema de Roles y Equipo
- ✅ Tabla `organization_members`: id, organization_id, user_id, role, doctor_id, invited_by
- ✅ Roles: owner | staff | doctor (superadmin invisible en UI)
- ✅ Sidebar filtra items según rol del usuario
- ✅ Badge de rol visible en sidebar (Admin / Colaborador / Médico)
- ✅ /team: panel de gestión de equipo
- ✅ /api/team/invite: invita via Supabase Auth + agrega a organization_members + crea doctor
- ✅ Protección de rutas por rol en `layout.tsx` y páginas (NO en middleware)
- ✅ Permisos por módulo según rol:
  | Módulo | Owner | Staff | Doctor |
  |---|---|---|---|
  | Dashboard | ✅✅ | ❌❌ | ❌❌ |
  | CRM | ✅✅ | ✅✅ | ❌❌ |
  | Agenda | ✅✅ | ✅✅ | ✅ solo suyas |
  | Doctores | ✅✅ | ✅ ver+disponibilidad | ✅ solo su perfil |
  | Conversaciones | ✅✅ | ✅✅ | ❌❌ |
  | Equipo | ✅✅ | ✅❌ | ❌❌ |
  | Configuración | ✅✅ | ✅✅ | Solo Integraciones |

### Onboarding Wizard (13 Mayo 2026)
- ✅ Wizard 4 pasos: Datos clínica → Primer médico → Disponibilidad → Link listo
- ✅ Cada paso guarda en DB al avanzar (no al final)
- ✅ Flag `onboarding_completed` en organizations
- ✅ Dashboard redirige a /onboarding si `onboarding_completed = false`
- ✅ Paso 4 crea appointment_type "Consulta general" automáticamente
- ✅ Teléfono obligatorio en onboarding paso 1
- ✅ Teléfono removido de /register (solo en onboarding)

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
- ✅ Filtrado por organization_id
- ✅ ⚠️ Sin disponibilidad + link "Configurar →" cuando días = —
- ✅ Rol doctor: solo su perfil, sin Nuevo médico ni Desactivar
- ✅ Disponibilidad /doctors/availability: estilo Cal.com

### CRM /crm
- ✅ Pipeline completo con 6 estados
- ✅ Vista Kanban con drag & drop
- ✅ Modal: citas vinculadas, comentarios, agendamiento interno
- ✅ Estado: dot color + keyword (max 15 chars)
- ✅ Fuente: texto compacto sin dot
- ✅ Orden columnas: Nombre, Cédula, Teléfono, Email, Estado, Fuente, Citas, Creado

### Dashboard /dashboard
- ✅ Funnel + tendencia mensual + agendamiento semanal + por médico
- ✅ Filtrado por organization_id (seguridad multi-tenant)

### Settings /settings
- ✅ General, Sedes, Tipos de cita, Procedimientos, Notificaciones, Automatizaciones, Integraciones
- ✅ Settings layout filtra tabs según rol (doctor solo ve Integraciones)
- ✅ /settings/procedures: CRUD de procedimientos (nombre, precio COP, activo/inactivo) con cards UI
- ✅ API /api/procedures: GET, POST, PATCH, DELETE — filtrado por organization_id, service role

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

### Conversaciones /conversations
- ✅ Tabla messages con RLS (organization_id, lead_id, channel, direction, content)
- ✅ API /api/conversations/webhook — recibe mensajes desde n8n
- ✅ UI estilo WhatsApp: lista agrupada por lead + chat con burbujas
- ✅ Filtros por canal, búsqueda, marca leídos
- ✅ n8n configurado: nodo Webhook Medscale APP en flujos WA, IG, FB

### Registro /register
- ✅ Rediseño profesional 2 pasos: selección de plan (4 cards) + formulario (2 columnas)
- ✅ Brand kit aplicado: colores `#EBF0F6`, `#215F73`, `#5A9DB5`, `#0D2B3E`
- ✅ Headline "El sistema de crecimiento para tu consultorio"
- ✅ Precios en USD (US$0, US$29, US$79, US$149)
- ✅ API /api/register/complete: crea organización + organization_members con rol owner
- ✅ Redirige a /onboarding después del registro
- ✅ Teléfono removido del formulario (solo en onboarding)
- ⚠️ Google OAuth en registro NO crea organización — solo funciona con email+password

### UX Improvements
- ✅ Sidebar sticky + colapsable con tooltips
- ✅ CRM estilo Airtable: compacto, edge-to-edge
- ✅ Agenda y Conversaciones edge-to-edge
- ✅ Padding individual por página
- ✅ `app/page.tsx` redirige a /login (no muestra boilerplate)

### Logo y Branding (13 Mayo 2026)
- ✅ Fix logo upload: bucket corregido de `'logos'` a `'organizations'`
- ✅ Logo en sidebar: se muestra logo de org si existe, fallback a ícono
- ✅ Logo en booking público: `/book/[org-slug]` y booking wizard muestran logo
- ✅ Sidebar theme dark/light: columna `sidebar_theme` en organizations, selector en /settings/general
- ✅ Booking header rediseñado: logo izq + stepper der, sin "Reservar cita", "Powered by MedScale AI"
- ✅ Booking wizard: si tiene logo muestra solo logo, si no muestra nombre como fallback

### Superadmin (13 Mayo 2026)
- ✅ Protección /admin: solo emails en `SUPERADMIN_EMAILS` (env var) pueden acceder
- ✅ Tabla `platform_admins`: user_id, email, role (owner/admin/support)
- ✅ Superadmin actions migradas: `createServiceClient()`, columnas directas (no metadata), `organization_members` para user count
- ✅ CRUD organizaciones: plan, is_active, ai_agent_enabled editables desde modal
- ✅ Impersonation: cookie `impersonate_org_id` (httpOnly, 4h max), `getSession()` verifica `platform_admins` antes de respetar cookie
- ✅ Org switcher dropdown: en sidebar del tenant Y sidebar del superadmin, solo visible para platform admins
- ✅ Dashboard superadmin: métricas globales (orgs, usuarios, leads, citas)

### Conversaciones — Fixes (13 Mayo 2026)
- ✅ Fix agrupamiento: mensaje outbound ahora incluye `sender_phone` del lead (antes era null)
- ✅ Retención 48h: pg_cron `cleanup_old_messages` corre a las 3am diario, borra mensajes > 2 días
- ✅ Aviso retención en términos del agente y footer del chat

### Sistema de Permisos Granulares (20 Mayo 2026)
- ✅ Columna `permissions` JSONB en `organization_members`
- ✅ Helper `lib/permissions.ts`: getUserPermissions(), canAccess(), canEdit()
- ✅ `getSession()` devuelve permissions
- ✅ Sidebar filtra módulos por permisos reales (ya no por array de roles)
- ✅ 5 páginas protegidas con canAccess() + redirect (dashboard, crm, scheduling, conversations, doctors)
- ✅ readOnly en CRM, Agenda y Doctores (oculta botones CRUD cuando permiso es 'read')
- ✅ Modal de permisos en /team con radio buttons (Sin acceso / Solo lectura / Completo)
- ✅ API /api/team/permissions protegida (owner-only, misma org)
- ✅ 3 niveles: none | read | full — 5 módulos configurables (sin team ni settings)
- ✅ Owner siempre full, doctor siempre filtrado por doctor_id (reglas fijas)
- ✅ Backwards compatible: permissions NULL = defaults del rol

### Auditoría de Seguridad (20 Mayo 2026)
- ✅ Multi-tenant: team/invite validado por sesión y org_id
- ✅ RLS activado en tabla organizations
- ✅ APIs públicas verificadas: secrets + UUID tokens
- ✅ Settings layout protegido server-side: staff redirect, doctor solo /settings/integrations
- ✅ /team protegido: owner-only con getSession()
- ✅ Eliminado write a tabla legacy `users` en team/invite

### Sincronización Lead ↔ Cita (20 Mayo 2026)
- ✅ Cita completada → lead status: asistio_a_cita
- ✅ Cita cancelada → lead status: cancelo_cita
- ✅ Cita no_show → lead status: cancelo_cita
- ✅ Cita reagendada → lead no cambia
- ✅ Aplica en scheduling/actions.ts y api/appointment/manage/route.ts
- ✅ Solo actualiza si la cita tiene lead_id asociado

### UX (20 Mayo 2026)
- ✅ Empty states en Dashboard, CRM y Calendario
- ✅ Favicon actualizado a MedScale brand (MS AI)
