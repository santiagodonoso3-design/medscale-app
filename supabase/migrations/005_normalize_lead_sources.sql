-- 005_normalize_lead_sources.sql
-- Migrar leads con fuentes legacy de ManyChat a 'whatsapp'
UPDATE public.leads
SET source = 'whatsapp'
WHERE source IN ('manychat', 'manychat_n8n')
  AND organization_id = '4270c9b0-cbaa-4a94-bea7-508387a2529c';
