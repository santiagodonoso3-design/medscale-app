-- Normaliza leads.status: 'asistio_a_cita' -> 'asistio_cita'
-- Causa raíz corregida en app/(app)/scheduling/actions.ts (writer)
-- Ejecutar en DB en vivo DESPUÉS de desplegar el fix de código.
BEGIN;
UPDATE leads
SET status = 'asistio_cita'
WHERE status = 'asistio_a_cita'
RETURNING id, organization_id, status;
COMMIT;
