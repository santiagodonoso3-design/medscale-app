-- 001_initial_schema.sql
-- Schema inicial para Supabase de la aplicación MedScale.

create extension if not exists "uuid-ossp";

-- Core organization model
create table public.organizations (
  id uuid not null primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid not null primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  city text,
  region text,
  postal_code text,
  country text,
  phone text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations_rooms (
  id uuid not null primary key default uuid_generate_v4(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  capacity int default 1,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Users table with roles and organization mapping
create table public.users (
  id uuid not null primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  default_location_id uuid references public.locations(id) on delete set null,
  role text not null default 'staff',
  first_name text,
  last_name text,
  phone text,
  title text,
  department text,
  is_active boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.superadmins (
  id uuid not null primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid not null primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_permissions (
  id uuid not null primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, permission_id)
);

create table public.doctors (
  id uuid not null primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  specialty text,
  license_number text,
  bio text,
  is_active boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedules (
  id uuid not null primary key default uuid_generate_v4(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  day_of_week smallint check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  is_recurring boolean not null default true,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_fields (
  id uuid not null primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  field_type text not null default 'text',
  required boolean not null default false,
  options jsonb default '[]'::jsonb,
  order_index int not null default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid not null primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  assigned_user_id uuid references public.users(id) on delete set null,
  source text,
  status text not null default 'new',
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_values (
  id uuid not null primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  lead_field_id uuid not null references public.lead_fields(id) on delete cascade,
  value text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, lead_field_id)
);

create table public.conversations (
  id uuid not null primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_user_id uuid references public.users(id) on delete set null,
  status text not null default 'open',
  subject text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_messages (
  id uuid not null primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  direction text not null default 'inbound',
  message text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid not null primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  status text not null default 'pending',
  scheduled_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointment_logs (
  id uuid not null primary key default uuid_generate_v4(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  event_type text not null,
  note text,
  performed_by uuid references public.users(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_logs (
  id uuid not null primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete set null,
  event_type text not null,
  payload jsonb,
  response jsonb,
  status text not null default 'pending',
  attempts int not null default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper functions
create or replace function public.get_user_org_id()
returns uuid
language sql
security definer
as $$
  select organization_id
  from public.users
  where id = auth.uid()::uuid;
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.superadmins
    where user_id = auth.uid()::uuid
  );
$$;

create or replace function public.has_role(role_name text)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and u.role = role_name
  );
$$;

create or replace function public.has_permission(permission_name text)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = auth.uid()::uuid
      and p.name = permission_name
  );
$$;

create or replace function public.set_timestamp()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Row Level Security policies
alter table public.organizations enable row level security;
create policy public_organizations_select
  on public.organizations
  for select
  using (
    public.is_superadmin() or id = public.get_user_org_id()
  );
create policy public_organizations_manage
  on public.organizations
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

alter table public.locations enable row level security;
create policy public_locations_org_members
  on public.locations
  for select
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );
create policy public_locations_modify
  on public.locations
  for all
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  )
  with check (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );

alter table public.locations_rooms enable row level security;
create policy public_locations_rooms_org_members
  on public.locations_rooms
  for select
  using (
    public.is_superadmin() or exists (
      select 1 from public.locations l where l.id = location_id and l.organization_id = public.get_user_org_id()
    )
  );
create policy public_locations_rooms_modify
  on public.locations_rooms
  for all
  using (
    public.is_superadmin() or exists (
      select 1 from public.locations l where l.id = location_id and l.organization_id = public.get_user_org_id()
    )
  )
  with check (
    public.is_superadmin() or exists (
      select 1 from public.locations l where l.id = location_id and l.organization_id = public.get_user_org_id()
    )
  );

alter table public.users enable row level security;
create policy public_users_org_members
  on public.users
  for select
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );
create policy public_users_modify
  on public.users
  for all
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  )
  with check (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );

alter table public.superadmins enable row level security;
create policy public_superadmins_superadmin
  on public.superadmins
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

alter table public.permissions enable row level security;
create policy public_permissions_org_members
  on public.permissions
  for select
  using (public.is_superadmin());
create policy public_permissions_manage
  on public.permissions
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

alter table public.user_permissions enable row level security;
create policy public_user_permissions_org_members
  on public.user_permissions
  for select
  using (
    public.is_superadmin() or exists (
      select 1 from public.users u where u.id = user_id and u.organization_id = public.get_user_org_id()
    )
  );
create policy public_user_permissions_modify
  on public.user_permissions
  for all
  using (
    public.is_superadmin() or exists (
      select 1 from public.users u where u.id = user_id and u.organization_id = public.get_user_org_id()
    )
  )
  with check (
    public.is_superadmin() or exists (
      select 1 from public.users u where u.id = user_id and u.organization_id = public.get_user_org_id()
    )
  );

alter table public.doctors enable row level security;
create policy public_doctors_org_members
  on public.doctors
  for select
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );
create policy public_doctors_modify
  on public.doctors
  for all
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  )
  with check (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );

alter table public.schedules enable row level security;
create policy public_schedules_org_members
  on public.schedules
  for select
  using (
    public.is_superadmin() or exists (
      select 1 from public.doctors d where d.id = doctor_id and d.organization_id = public.get_user_org_id()
    )
  );
create policy public_schedules_modify
  on public.schedules
  for all
  using (
    public.is_superadmin() or exists (
      select 1 from public.doctors d where d.id = doctor_id and d.organization_id = public.get_user_org_id()
    )
  )
  with check (
    public.is_superadmin() or exists (
      select 1 from public.doctors d where d.id = doctor_id and d.organization_id = public.get_user_org_id()
    )
  );

alter table public.lead_fields enable row level security;
create policy public_lead_fields_org_members
  on public.lead_fields
  for select
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );
create policy public_lead_fields_modify
  on public.lead_fields
  for all
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  )
  with check (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );

alter table public.leads enable row level security;
create policy public_leads_org_members
  on public.leads
  for select
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );
create policy public_leads_modify
  on public.leads
  for all
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  )
  with check (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );

alter table public.lead_values enable row level security;
create policy public_lead_values_org_members
  on public.lead_values
  for select
  using (
    public.is_superadmin() or exists (
      select 1
      from public.leads l
      where l.id = lead_id and l.organization_id = public.get_user_org_id()
    )
  );
create policy public_lead_values_modify
  on public.lead_values
  for all
  using (
    public.is_superadmin() or exists (
      select 1
      from public.leads l
      where l.id = lead_id and l.organization_id = public.get_user_org_id()
    )
  )
  with check (
    public.is_superadmin() or exists (
      select 1
      from public.leads l
      where l.id = lead_id and l.organization_id = public.get_user_org_id()
    )
  );

alter table public.conversations enable row level security;
create policy public_conversations_org_members
  on public.conversations
  for select
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );
create policy public_conversations_modify
  on public.conversations
  for all
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  )
  with check (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );

alter table public.conversation_messages enable row level security;
create policy public_conversation_messages_org_members
  on public.conversation_messages
  for select
  using (
    public.is_superadmin() or exists (
      select 1
      from public.conversations c
      where c.id = conversation_id and c.organization_id = public.get_user_org_id()
    )
  );
create policy public_conversation_messages_modify
  on public.conversation_messages
  for all
  using (
    public.is_superadmin() or exists (
      select 1
      from public.conversations c
      where c.id = conversation_id and c.organization_id = public.get_user_org_id()
    )
  )
  with check (
    public.is_superadmin() or exists (
      select 1
      from public.conversations c
      where c.id = conversation_id and c.organization_id = public.get_user_org_id()
    )
  );

alter table public.appointments enable row level security;
create policy public_appointments_org_members
  on public.appointments
  for select
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );
create policy public_appointments_modify
  on public.appointments
  for all
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  )
  with check (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );

alter table public.appointment_logs enable row level security;
create policy public_appointment_logs_org_members
  on public.appointment_logs
  for select
  using (
    public.is_superadmin() or exists (
      select 1
      from public.appointments a
      where a.id = appointment_id and a.organization_id = public.get_user_org_id()
    )
  );
create policy public_appointment_logs_modify
  on public.appointment_logs
  for all
  using (
    public.is_superadmin() or exists (
      select 1
      from public.appointments a
      where a.id = appointment_id and a.organization_id = public.get_user_org_id()
    )
  )
  with check (
    public.is_superadmin() or exists (
      select 1
      from public.appointments a
      where a.id = appointment_id and a.organization_id = public.get_user_org_id()
    )
  );

alter table public.webhook_logs enable row level security;
create policy public_webhook_logs_org_members
  on public.webhook_logs
  for select
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );
create policy public_webhook_logs_modify
  on public.webhook_logs
  for all
  using (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  )
  with check (
    public.is_superadmin() or organization_id = public.get_user_org_id()
  );

-- Triggers for updated_at
create trigger update_organizations_updated_at
before update on public.organizations
for each row execute procedure public.set_timestamp();

create trigger update_locations_updated_at
before update on public.locations
for each row execute procedure public.set_timestamp();

create trigger update_locations_rooms_updated_at
before update on public.locations_rooms
for each row execute procedure public.set_timestamp();

create trigger update_users_updated_at
before update on public.users
for each row execute procedure public.set_timestamp();

create trigger update_permissions_updated_at
before update on public.permissions
for each row execute procedure public.set_timestamp();

create trigger update_user_permissions_updated_at
before update on public.user_permissions
for each row execute procedure public.set_timestamp();

create trigger update_doctors_updated_at
before update on public.doctors
for each row execute procedure public.set_timestamp();

create trigger update_schedules_updated_at
before update on public.schedules
for each row execute procedure public.set_timestamp();

create trigger update_lead_fields_updated_at
before update on public.lead_fields
for each row execute procedure public.set_timestamp();

create trigger update_leads_updated_at
before update on public.leads
for each row execute procedure public.set_timestamp();

create trigger update_lead_values_updated_at
before update on public.lead_values
for each row execute procedure public.set_timestamp();

create trigger update_conversations_updated_at
before update on public.conversations
for each row execute procedure public.set_timestamp();

create trigger update_conversation_messages_updated_at
before update on public.conversation_messages
for each row execute procedure public.set_timestamp();

create trigger update_appointments_updated_at
before update on public.appointments
for each row execute procedure public.set_timestamp();

create trigger update_webhook_logs_updated_at
before update on public.webhook_logs
for each row execute procedure public.set_timestamp();
