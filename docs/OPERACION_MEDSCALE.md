# OPERACION_MEDSCALE.md

Cómo se trabaja MedScale AI. Este archivo describe **el modo de operar**, no el producto ni el estado.

**Complementa a:**
- `ESTADO_MEDSCALE.md` — foto viva del proyecto (fases, deuda, decisiones)
- `CLAUDE.md` (raíz del repo) — contexto técnico que Claude Code necesita en cada prompt

Basado en la plantilla `OPERACION_[PROYECTO].md` propia. Adaptado a MedScale septiembre 2026.

---

## Contexto MedScale

SaaS multi-tenant de gestión médica para clínicas Colombia y Latam. Producción con clientes pagando (Ferttes y Bariatric). Cada bug afecta consultas reales, correos reales, dinero real.

**Stack:** Next.js 15 App Router, Supabase (Postgres + Auth + RLS), TypeScript, Tailwind v4, shadcn/ui, deploy Vercel autodeploy desde `main`. Repo `santiagodonoso3-design/medscale-app`. Local `C:\Users\sdono\claude-projects\Proyecto 1\medscale-app`.

**Único desarrollador:** Santiago (fundador). Sin equipo técnico. Sin QA. Sin staging.

Esa realidad define todo lo que sigue.

---

## Los 5 principios innegociables

Si un cambio los viola, no entra a producción.

### 1. Medir antes de asumir
Cuando el código dice X y el comportamiento real dice Y, gana el real. Nunca diagnosticar por lectura de archivo cuando hay forma de medir en DB o en pantalla. Con Supabase MCP no hay excusa.

### 2. Probar antes de anunciar
Nada de "ya está listo" sin haber recorrido el flujo con datos reales. Con Ferttes y Bariatric en producción, quien descubre el bug es el cliente.

### 3. Base primero, funciones después, front al final
Si un cambio nuevo llama a una tabla o RPC que aún no existe, truena en cuanto despliega. Orden fijo: migración SQL → código motor → UI. Fase 0 es el ejemplo canónico.

### 4. Un cambio, un commit
Los bugs se cazan más rápido cuando el diff es pequeño y temático. Si Claude Code entrega tres cosas en un commit, se pide separar. Si el scope se cruza (refactor URLs + rediseño UX), dos commits atómicos separados aunque signifique tocar archivos superpuestos.

### 5. Retirar código muerto vale tanto como escribir código nuevo
`AUDIENCE_OPTIONS` hardcoded, `APP_URL` como constante en cada archivo, `FIXED_RULE_TYPES` — cada uno es una puerta abierta al patrón viejo. Cuando se detecta, se retira en el mismo PR que lo detecta.

---

## Reparto de roles

### El humano (Santiago)
- Decide qué se hace y qué no
- Aplica los despliegues (`git push` es su acto)
- Confirma operaciones destructivas
- Recibe reportes de Ferttes y Bariatric
- Prueba visualmente antes de anunciar

### Claude conversacional (chat de diagnóstico)
- Diagnóstico contra Supabase MCP en vivo
- Redacta prompts precisos para Claude Code
- Revisa reportes de Claude Code con criterio (no valida por defecto)
- Verifica en producción que un cambio funcionó (queries post-deploy)
- Diseña arquitectura, propone decisiones con opciones + voto
- **No modifica archivos del repo**

### Claude Code (agente de código)
- Edita archivos del repo
- Corre `npx next build`
- Reporta con diff y verificaciones
- **No hace `git commit` ni `git push`** — Santiago revisa antes

**Regla de oro:** ninguna IA despliega. Ninguna IA aplica cambios destructivos sin OK explícito de Santiago.

---

## Protocolos base

### Protocolo 1 — Antes de tocar código
1. Reproducir o medir. Si es DB, Claude conversacional consulta Supabase MCP. Si es UI, Santiago abre `npm run dev` (o producción con cuidado).
2. El prompt se redacta en el chat de diagnóstico, no se le pide a Claude Code directamente.
3. El prompt incluye: contexto medido, tarea exacta, reglas estrictas, criterios de aceptación, formato de reporte.

### Protocolo 2 — Recibir reporte de Claude Code
Nunca se acepta sin leerlo con criterio. Preguntas obligatorias:
- ¿Hizo lo que pedí, o lo que él creyó que pedí?
- ¿El diagnóstico coincide con lo que veo en la DB / pantalla?
- ¿Encontró hallazgos colaterales que atender aparte?
- ¿Deshabilitó o retiró algo que estaba en uso?
- ¿Cambió el scope sin avisar? (frecuente cuando el prompt tiene ambigüedades)

### Protocolo 3 — Aplicar cambios en producción
Orden fijo:
1. Aplicar cambios de DB (migraciones vía Supabase MCP o SQL editor)
2. Verificar contra la DB que están aplicados (query de confirmación)
3. Prompt a Claude Code, recibir reporte, revisar
4. Verificación PowerShell local (grep + build)
5. Verificación visual local con `npm run dev` cuando el cambio es UI
6. Commit + push
7. Esperar autodeploy Vercel (~2 min)
8. Verificación en producción (query DB si aplica, disparo manual de cron, screenshot)
9. Solo entonces se considera "cerrado"

### Protocolo 4 — Cuenta de prueba
No hay cuenta separada. Se usa:
- **Aurora Estética (demo)** para pruebas destructivas o experimentales
- **Ferttes o Bariatric** solo para verificar comportamiento real, nunca para experimentar

Antes de cualquier cambio que afecte UX del cliente:
1. Correr flujo en local con `npm run dev`
2. Después de deploy, correr flujo en producción con Aurora
3. Solo entonces confirmar que Ferttes/Bariatric están bien

### Protocolo 5 — Automatizar detección de patrones repetidos
Cuando un bug aparece dos veces con la misma causa, no se arregla ese bug — se arregla el patrón. Ejemplos históricos:
- `AUDIENCE_OPTIONS` hardcoded → dinámico desde catálogo (Fase 1)
- URLs `app.medscale.app` en 20+ lugares → helper `getAppUrl()` (Refactor URLs)
- Envío de correo duplicado posible → unique constraint DB + `occurrence_key` determinístico (Fase 0)

Cuando se detecta un tercer caso de un patrón conocido, se levanta como refactor prioritario, no como fix puntual.

### Protocolo 6 — Verificación DB con MCP antes de refactor
Cuando el cambio toca schema o data, Claude conversacional corre queries en Supabase MCP para:
- Confirmar structure real (drift entre migrations y DB en vivo — gana DB en vivo)
- Ver estado real de los datos (no asumir por muestreo)
- Después del deploy, verificar que la migration funcionó

Es la razón por la que Supabase MCP está enganchado. Sin él, se diagnostica a ciegas.

### Protocolo 7 — Dos commits atómicos cuando el scope se cruza
Si un trabajo mezcla dos scopes conceptualmente distintos (refactor técnico + feature nueva), se hacen dos commits separados aunque signifique tocar el mismo archivo dos veces. Ejemplo real: refactor URLs (`chore:`) + rediseño UX (`feat:`) el 3 sep.

Beneficio: si algo se rompe, el rollback quirúrgico sabe qué revertir.

### Protocolo 8 — Nunca pegar secrets en chat
Regla aprendida el 3 sep 2026 tras exponer `CRON_SECRET` accidentalmente. Para pasar secrets a scripts locales:
- `Get-Credential` con pop-up de Windows (permite paste con Ctrl+V)
- `Read-Host -AsSecureString` cuando la terminal lo permita
- Env vars locales cargadas de `.env.local`

Si un secret se expone accidentalmente:
1. Rotar inmediatamente en Vercel
2. Redeploy o esperar propagación
3. Limpiar historial local de PowerShell
4. Anotar en `ESTADO_MEDSCALE.md` la rotación

---

## Cadencia

**Diaria (5 min):**
- Revisar `ESTADO_MEDSCALE.md`
- Ver reportes nuevos de Ferttes/Bariatric
- Confirmar en DB si algo se cargó, activó o rompió

**Semanal (30 min):**
- Actualizar `ESTADO_MEDSCALE.md` con fases cerradas, deuda, decisiones
- Revisar backlog: bajar prioridad de lo obsoleto, subir lo urgente

**Al cerrar cada fase:**
- Actualizar entrada en tabla de fases cerradas con commit hash y fecha
- Anotar deuda técnica descubierta durante la fase

Cadencias mensual/trimestral están omitidas hasta que aparezca detonante (contratar dev, cerrar cliente enterprise, entrar Yingo/LadeRH al mismo modo de trabajo).

---

## Errores comunes MedScale (casos reales)

### Diagnosticar por lectura de código, no por medición
El código dice X pero pasa Y. Se pierden horas leyendo cuando 30 segundos de query a Supabase MCP resuelven. **Solución:** Principio 1 + Protocolo 6.

### Anunciar sin probar
"Está listo" y el cliente descubre el bug. Con Ferttes y Bariatric en producción, esto no perdona. **Solución:** Protocolo 4 obligatorio.

### Deploy en orden equivocado
Función nueva desplegada antes de la migración que necesita → rompe cron o UI por minutos. **Solución:** Protocolo 3 orden fijo, sin excepciones.

### Claude Code "aprovecha" y arregla otras cosas
Un PR de "arreglar bug X" viene con 3 cambios extra que rompen 2 flujos. Cada línea que no pediste es una línea a verificar. **Solución:** Principio 4 + Protocolo 2 (preguntar "¿cambió scope sin avisar?").

### Patrón malo repetido en múltiples lugares
`AUDIENCE_OPTIONS` en 3 líneas, `APP_URL` en 20+ lugares. Se arreglan de a uno cuando aparecen, no todos a la vez. **Solución:** Protocolo 5, refactor apalancado cuando aparece tercera repetición.

### Confiar en reporte de Claude Code sin verificar
El reporte dice "compiled successfully" pero el UI está roto. El reporte es autoridad sobre lo técnico, no sobre lo visual ni lo funcional. **Solución:** Protocolo 3 pasos 5 y 8 obligatorios.

### Exponer secrets en chat
CRON_SECRET pegado sin comillas en PowerShell → visible en logs. **Solución:** Protocolo 8 estricto.

### Adivinar sin acceso Supabase MCP
Antes de tener MCP conectado, se asumía estado de tablas. Ya no aplica. **Solución:** Siempre confirmar con MCP antes de proponer schema.

---

## Cuándo pedir criterio antes de proceder

Casos donde Santiago no debe decidir solo. Preguntar antes de ejecutar:

- Cambios que puedan afectar a Ferttes o Bariatric en producción (correos, agendamiento, CRM)
- Borrar tablas o columnas con datos históricos
- Cambios en RLS o permisos que puedan exponer datos multi-tenant
- Cambios que afecten cumplimiento (Habeas Data Colombia, HIPAA-adjacent)
- Cambios de precio o modelo de negocio en Mercado Pago
- Migraciones sobre `schema_migrations` (está desincronizado con repo, `supabase db push` sería destructivo)
- Decisiones donde dos usuarios se pierden entre sí (conflicto de datos)

El resto se decide solo. Cuando aplique, escribir la decisión y racional en "Decisiones tomadas recientes" de `ESTADO_MEDSCALE.md` para que un Claude futuro (o Santiago-del-futuro) no reabra el debate.

---

## Herramientas base

- **VSCode** con formateo automático (existente en el setup)
- **GitHub** para PRs (Santiago trabaja directo en `main`, no hay branches por ahora)
- **Claude Code** para ejecutar código
- **Claude conversacional con Supabase MCP** para diagnóstico y arquitectura
- **Supabase dashboard** (`tfqakdffusydutmzditz`)
- **Vercel dashboard** (deploy + env vars)
- **PowerShell** en Windows (no bash — todos los comandos van con sintaxis PS)

Detalles operativos específicos de cada herramienta (rutas, envs, integraciones) están en `CLAUDE.md`.

---

## Filosofía

**Corto a propósito.** Si esto crece a 15 protocolos no se sigue. Cuando agregues uno, considera si podés retirar otro.

**Escrito, no memorizado.** Los 5 principios se aplican siempre. Cuando dudes, consultá el archivo. La memoria falla; el documento no.

**Vivo, no dogma.** Cada aprendizaje se agrega a "Errores comunes" del proyecto donde emergió. Los patrones transversales vuelven a la plantilla base para el próximo proyecto.

**No sustituye pensar.** Es un piso, no un techo. Los buenos productos vienen de decisiones bien pensadas, no de checklists bien seguidas.

---

**Autor de la plantilla base:** Santiago Donoso (Yingo, LadeRH®, MedScale AI).
**Última revisión de este documento:** 3 de septiembre de 2026.
