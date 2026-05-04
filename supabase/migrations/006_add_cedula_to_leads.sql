-- 006_add_cedula_to_leads.sql
alter table public.leads add column if not exists contact_cedula text;
