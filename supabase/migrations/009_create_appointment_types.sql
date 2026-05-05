CREATE TABLE appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  color TEXT DEFAULT '#6366f1',
  modality TEXT DEFAULT 'presencial',
  price NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  assignment_mode TEXT NOT NULL DEFAULT 'hybrid'
    CHECK (assignment_mode IN ('one_on_one','round_robin_proportional','round_robin_availability','hybrid')),
  doctor_ids UUID[] DEFAULT '{}',
  min_notice_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read appointment_types"
ON appointment_types FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM users WHERE id = auth.uid()
));
