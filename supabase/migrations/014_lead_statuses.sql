-- Catálogo de estados del pipeline por organización + FK compuesta en leads.
-- NOTA: aplicada manualmente en la DB en vivo el 2026-08-04.
-- Este archivo documenta el schema, NO re-ejecutar.

BEGIN;

CREATE TABLE IF NOT EXISTS lead_statuses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key             text NOT NULL,
  label           text NOT NULL,
  color           text NOT NULL DEFAULT '#64748b',
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  is_system       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_statuses_org_key_unique UNIQUE (organization_id, key),
  CONSTRAINT lead_statuses_key_format CHECK (key ~ '^[a-z0-9_]+$')
);

CREATE INDEX IF NOT EXISTS idx_lead_statuses_org ON lead_statuses(organization_id, sort_order);

DROP TRIGGER IF EXISTS update_lead_statuses_updated_at ON lead_statuses;
CREATE TRIGGER update_lead_statuses_updated_at
  BEFORE UPDATE ON lead_statuses
  FOR EACH ROW EXECUTE FUNCTION set_timestamp();

INSERT INTO lead_statuses (organization_id, key, label, color, sort_order, is_system)
SELECT o.id, s.key, s.label, s.color, s.sort_order, true
FROM organizations o
CROSS JOIN (VALUES
  ('contactado',               'Contactado',                '#64748b', 10),
  ('cita_valoracion_agendada', 'Cita de valoración agendada','#3b82f6', 20),
  ('asistio_cita',             'Asistió a cita',            '#10b981', 30),
  ('cancelo_cita',             'Canceló cita',              '#ef4444', 40),
  ('en_tratamiento_medico',    'En tratamiento médico',     '#f59e0b', 50),
  ('finalizado',               'Finalizado',                '#6b7280', 60)
) AS s(key, label, color, sort_order)
ON CONFLICT (organization_id, key) DO NOTHING;

ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_statuses_select ON lead_statuses;
CREATE POLICY lead_statuses_select ON lead_statuses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_statuses_write ON lead_statuses;
CREATE POLICY lead_statuses_write ON lead_statuses
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Enforcement en leads: sin default muerto, con índice de soporte y FK compuesta.
ALTER TABLE leads ALTER COLUMN status DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(organization_id, status);

ALTER TABLE leads
  ADD CONSTRAINT leads_status_fkey
  FOREIGN KEY (organization_id, status)
  REFERENCES lead_statuses(organization_id, key)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

COMMIT;
