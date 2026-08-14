alter table public.platform_admins
  add column if not exists scope text not null default 'assigned'
  constraint platform_admins_scope_check check (scope in ('global','assigned'));

update public.platform_admins set scope = 'global' where role = 'owner';

create unique index if not exists platform_admins_user_id_key
  on public.platform_admins (user_id);

create table if not exists public.platform_admin_organizations (
  id uuid primary key default gen_random_uuid(),
  platform_admin_id uuid not null references public.platform_admins(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint platform_admin_organizations_unique unique (platform_admin_id, organization_id)
);

alter table public.platform_admin_organizations enable row level security;
