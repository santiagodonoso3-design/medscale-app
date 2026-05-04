-- 007_lead_comments.sql
create table public.lead_comments (
  id         uuid        not null primary key default uuid_generate_v4(),
  lead_id    uuid        not null references public.leads(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  comment    text        not null,
  created_at timestamptz not null default now()
);

alter table public.lead_comments enable row level security;

create policy "org members can manage lead comments"
  on public.lead_comments for all
  using (
    lead_id in (
      select l.id from public.leads l
      join public.users u on u.organization_id = l.organization_id
      where u.id = auth.uid()
    )
  )
  with check (
    lead_id in (
      select l.id from public.leads l
      join public.users u on u.organization_id = l.organization_id
      where u.id = auth.uid()
    )
  );

create index lead_comments_lead_id_idx on public.lead_comments(lead_id);
