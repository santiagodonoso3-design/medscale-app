-- Migrate lead statuses to new pipeline slugs
-- nuevo          → contactado
-- en_procedimiento → en_tratamiento_medico
-- perdido        → cancelo_cita
-- (agendado, contactado, finalizado handled in STATUS_NORMALIZE at app layer)

UPDATE leads SET status = 'contactado'          WHERE status = 'nuevo';
UPDATE leads SET status = 'en_tratamiento_medico' WHERE status = 'en_procedimiento';
UPDATE leads SET status = 'cancelo_cita'         WHERE status = 'perdido';
