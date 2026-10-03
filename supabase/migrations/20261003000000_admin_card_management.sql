begin;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('card.create','card.update','card.delete','card.import')),
  card_id uuid,
  card_snapshot jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);
create index admin_audit_logs_admin_user_idx on public.admin_audit_logs(admin_user_id, created_at desc);

alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_users, public.admin_audit_logs from public, anon, authenticated;
grant all on table public.admin_users, public.admin_audit_logs to service_role;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

commit;
