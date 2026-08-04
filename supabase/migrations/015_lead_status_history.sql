-- Historial de transiciones de estado de leads (cronómetro para automatizaciones).
-- NOTA: aplicada manualmente en la DB en vivo el 2026-08-04.
-- Este archivo documenta el schema, NO re-ejecutar.

BEGIN;

CREATE TABLE IF NOT EXISTS lead_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_status     text,
  to_status       text NOT NULL,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  changed_by      uuid,
  is_seed         boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_lsh_org_status_date
  ON lead_status_history(organization_id, to_status, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lsh_lead
  ON lead_status_history(lead_id, changed_at DESC);

CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS trigger AS $$
BEGIN
  INSERT INTO lead_status_history (
    organization_id, lead_id, from_status, to_status, changed_by
  ) VALUES (
    NEW.organization_id, NEW.id, OLD.status, NEW.status, auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lead_status_change ON leads;
CREATE TRIGGER trg_lead_status_change
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_lead_status_change();

-- Semilla: estado actual de cada lead como punto de partida del reloj.
INSERT INTO lead_status_history (organization_id, lead_id, from_status, to_status, changed_at, is_seed)
SELECT organization_id, id, NULL, status, updated_at, true
FROM leads
WHERE NOT EXISTS (
  SELECT 1 FROM lead_status_history h WHERE h.lead_id = leads.id
);

ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lsh_select ON lead_status_history;
CREATE POLICY lsh_select ON lead_status_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

COMMIT;
