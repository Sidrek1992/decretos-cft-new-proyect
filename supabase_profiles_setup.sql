-- Ejecutar una vez en Supabase SQL Editor
create table if not exists public.profiles (
  email text primary key,
  role text not null default 'reader' check (role in ('admin', 'editor', 'reader')),
  first_name text not null default '',
  last_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

alter table public.profiles enable row level security;

-- Cada usuario autenticado puede leer perfiles (necesario para resolver roles)
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

-- Cada usuario puede insertar/actualizar solo su propio perfil (usando lower para mayor seguridad)
drop policy if exists "Users can upsert own profile" on public.profiles;
create policy "Users can upsert own profile"
on public.profiles
for insert
to authenticated
with check (lower(auth.jwt() ->> 'email') = lower(email));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (lower(auth.jwt() ->> 'email') = lower(email))
with check (lower(auth.jwt() ->> 'email') = lower(email));

create or replace function public.authenticated_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(u.email)
  from auth.users u
  where u.id = auth.uid()
$$;

revoke all on function public.authenticated_email() from public;
grant execute on function public.authenticated_email() to authenticated;

-- Admins autorizados pueden gestionar todos los perfiles
drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
on public.profiles
for all
to authenticated
using (
  public.authenticated_email() in (
    'mguzmanahumada@gmail.com',
    'a.gestiondepersonas@cftestatalaricayparinacota.cl',
    'gestiondepersonas@cftestatalaricayparinacota.cl',
    'analista.gp@cftestatalaricayparinacota.cl',
    'asis.gestiondepersonas@cftestatalaricayparinacota.cl'
  )
)
with check (
  public.authenticated_email() in (
    'mguzmanahumada@gmail.com',
    'a.gestiondepersonas@cftestatalaricayparinacota.cl',
    'gestiondepersonas@cftestatalaricayparinacota.cl',
    'analista.gp@cftestatalaricayparinacota.cl',
    'asis.gestiondepersonas@cftestatalaricayparinacota.cl'
  )
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- Usuarios administradores iniciales
insert into public.profiles (email, role, first_name, last_name)
values
  ('a.gestiondepersonas@cftestatalaricayparinacota.cl', 'admin', '', ''),
  ('mguzmanahumada@gmail.com', 'admin', '', ''),
  ('gestiondepersonas@cftestatalaricayparinacota.cl', 'admin', '', ''),
  ('analista.gp@cftestatalaricayparinacota.cl', 'admin', '', ''),
  ('asis.gestiondepersonas@cftestatalaricayparinacota.cl', 'admin', '', '')
on conflict (email)
do update set role = excluded.role, updated_at = now();

-- Bus de eventos para sincronización en tiempo real entre administradores
create table if not exists public.sync_events (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('records', 'employees', 'admin')),
  action text not null,
  actor_email text,
  origin_client_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on table public.sync_events to authenticated;

alter table public.sync_events enable row level security;

drop policy if exists "Authenticated users can read sync events" on public.sync_events;
create policy "Authenticated users can read sync events"
on public.sync_events
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert sync events" on public.sync_events;
create policy "Authenticated users can insert sync events"
on public.sync_events
for insert
to authenticated
with check (auth.uid() is not null);

create index if not exists idx_sync_events_scope_created_at
on public.sync_events (scope, created_at desc);

-- Habilitar tablas en publicación Realtime (idempotente)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'sync_events'
    ) then
      alter publication supabase_realtime add table public.sync_events;
    end if;
  end if;
end;
$$;

-- ==========================================
-- AUDIT LOGS & VERSIONING
-- ==========================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  action text not null,
  actor_email text not null,
  target_id text,
  target_name text,
  old_data jsonb,
  new_data jsonb,
  details text,
  created_at timestamptz not null default now()
);

grant select, insert on table public.audit_logs to authenticated;
alter table public.audit_logs enable row level security;

drop policy if exists "Admins can read all audit logs" on public.audit_logs;
create policy "Admins can read all audit logs"
on public.audit_logs
for select
to authenticated
using (
  public.authenticated_email() in (
    'mguzmanahumada@gmail.com',
    'a.gestiondepersonas@cftestatalaricayparinacota.cl',
    'gestiondepersonas@cftestatalaricayparinacota.cl',
    'analista.gp@cftestatalaricayparinacota.cl',
    'asis.gestiondepersonas@cftestatalaricayparinacota.cl'
  )
);

drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs;
create policy "Authenticated users can insert audit logs"
on public.audit_logs
for insert
to authenticated
with check (true);

create index if not exists idx_audit_logs_actor_email on public.audit_logs (actor_email);
create index if not exists idx_audit_logs_scope_action on public.audit_logs (scope, action);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);

-- Añadir audit_logs a la publicación Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'audit_logs'
    ) then
      alter publication supabase_realtime add table public.audit_logs;
    end if;
  end if;
end;
$$;
