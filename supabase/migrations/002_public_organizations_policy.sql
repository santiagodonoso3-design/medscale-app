-- 002_public_organizations_policy.sql
-- Agregar políticas públicas para permitir lectura sin autenticación
-- Necesario para /book/[org-slug] que es público

-- Organizations
create policy public_organizations_public_read
  on public.organizations
  for select
  using (true);

-- Locations
create policy public_locations_public_read
  on public.locations
  for select
  using (true);

-- Doctors
create policy public_doctors_public_read
  on public.doctors
  for select
  using (true);

-- Schedules
create policy public_schedules_public_read
  on public.schedules
  for select
  using (true);

-- Appointment form fields (si existe)
-- create policy public_appointment_form_fields_public_read
--   on public.appointment_form_fields
--   for select
--   using (true);