-- 004_add_appointment_types.sql
create table public.appointment_types (
  id uuid not null primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  duration_minutes int not null default 60,
  color text not null default '#3B82F6',
  modality text not null default 'presencial',
  price int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_types_modality_check check (modality in ('presencial', 'virtual')),
  unique (organization_id, slug)
);

alter table public.appointment_types enable row level security;

create policy "org members can manage appointment types"
  on public.appointment_types for all
  using (
    organization_id in (
      select organization_id from public.users where id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select organization_id from public.users where id = auth.uid()
    )
  );
