-- Studi: External calendar integrations (Google, Microsoft, Apple iCloud, ICS)
-- Run AFTER 001–017. Do NOT apply automatically from the app.
--
-- Tables:
--   external_calendar_connections — linked provider accounts (metadata only)
--   external_calendar_secrets     — AES-GCM ciphertext; no authenticated SELECT
--   external_calendars            — calendars within a connection
--   external_calendar_events      — mirrored events (read-only in Studi)
--   external_event_links          — optional links to native exams/tasks
--   calendar_oauth_states         — short-lived PKCE/state (server-only)
--
-- Secrets: app encrypts with STUDI_CALENDAR_SECRETS_KEY; ciphertext stored here.
-- Authenticated clients cannot SELECT secrets. Owners read via get_own_calendar_secret.
-- Cron sync across users requires SUPABASE_SERVICE_ROLE_KEY.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'external_calendar_provider') then
    create type public.external_calendar_provider as enum (
      'google',
      'microsoft',
      'icloud',
      'ics'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'external_connection_status') then
    create type public.external_connection_status as enum (
      'pending',
      'active',
      'needs_reauth',
      'error',
      'disconnected'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'external_event_show_as') then
    create type public.external_event_show_as as enum (
      'busy',
      'free',
      'tentative',
      'oof',
      'unknown'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'external_event_link_kind') then
    create type public.external_event_link_kind as enum (
      'assessment',
      'task',
      'ignored'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Connections (metadata — never store plaintext tokens here)
-- ---------------------------------------------------------------------------
create table if not exists public.external_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.external_calendar_provider not null,
  status public.external_connection_status not null default 'pending',
  account_label text null,
  account_email text null,
  provider_account_id text null,
  scopes text[] not null default '{}',
  last_sync_at timestamptz null,
  last_successful_sync_at timestamptz null,
  last_sync_error text null,
  sync_cursor text null,
  dedupe_fingerprint text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_calendar_connections_provider_account_unique
    unique nulls not distinct (user_id, provider, provider_account_id)
);

create index if not exists external_calendar_connections_user_idx
  on public.external_calendar_connections (user_id);

create index if not exists external_calendar_connections_sync_idx
  on public.external_calendar_connections (status, last_sync_at)
  where status = 'active';

drop trigger if exists external_calendar_connections_set_updated_at
  on public.external_calendar_connections;
create trigger external_calendar_connections_set_updated_at
before update on public.external_calendar_connections
for each row execute function public.set_updated_at();

create or replace function public.enforce_external_connection_ownership()
returns trigger
language plpgsql
as $$
begin
  -- Service role (scheduled sync) bypasses uid checks; RLS is already bypassed.
  if auth.uid() is null then
    if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
      return new;
    end if;
    raise exception 'Not allowed';
  end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  elsif new.user_id is distinct from old.user_id or new.user_id is distinct from auth.uid() then
    raise exception 'Not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists external_calendar_connections_enforce_ownership
  on public.external_calendar_connections;
create trigger external_calendar_connections_enforce_ownership
before insert or update on public.external_calendar_connections
for each row execute function public.enforce_external_connection_ownership();

alter table public.external_calendar_connections enable row level security;

drop policy if exists "External connections select own" on public.external_calendar_connections;
create policy "External connections select own"
on public.external_calendar_connections for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "External connections insert own" on public.external_calendar_connections;
create policy "External connections insert own"
on public.external_calendar_connections for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "External connections update own" on public.external_calendar_connections;
create policy "External connections update own"
on public.external_calendar_connections for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "External connections delete own" on public.external_calendar_connections;
create policy "External connections delete own"
on public.external_calendar_connections for delete to authenticated
using (auth.uid() = user_id);

revoke all on public.external_calendar_connections from anon;
grant select, insert, update, delete on public.external_calendar_connections to authenticated;

-- ---------------------------------------------------------------------------
-- Secrets (ciphertext only; no authenticated SELECT policy)
-- ---------------------------------------------------------------------------
create table if not exists public.external_calendar_secrets (
  connection_id uuid primary key
    references public.external_calendar_connections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists external_calendar_secrets_user_idx
  on public.external_calendar_secrets (user_id);

drop trigger if exists external_calendar_secrets_set_updated_at
  on public.external_calendar_secrets;
create trigger external_calendar_secrets_set_updated_at
before update on public.external_calendar_secrets
for each row execute function public.set_updated_at();

alter table public.external_calendar_secrets enable row level security;

-- Owners may write/delete their ciphertext rows; never SELECT via RLS.
drop policy if exists "External secrets insert own" on public.external_calendar_secrets;
create policy "External secrets insert own"
on public.external_calendar_secrets for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.external_calendar_connections c
    where c.id = connection_id and c.user_id = auth.uid()
  )
);

drop policy if exists "External secrets update own" on public.external_calendar_secrets;
create policy "External secrets update own"
on public.external_calendar_secrets for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "External secrets delete own" on public.external_calendar_secrets;
create policy "External secrets delete own"
on public.external_calendar_secrets for delete to authenticated
using (auth.uid() = user_id);

-- Explicitly no SELECT policy for authenticated/anon.
revoke all on public.external_calendar_secrets from anon;
revoke select on public.external_calendar_secrets from authenticated;
grant insert, update, delete on public.external_calendar_secrets to authenticated;

-- Owner-only ciphertext fetch for server-side decryption (never returns plaintext).
create or replace function public.get_own_calendar_secret(p_connection_id uuid)
returns table (
  connection_id uuid,
  ciphertext text,
  iv text,
  auth_tag text,
  key_version integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not allowed';
  end if;
  return query
  select s.connection_id, s.ciphertext, s.iv, s.auth_tag, s.key_version
  from public.external_calendar_secrets s
  where s.connection_id = p_connection_id
    and s.user_id = auth.uid();
end;
$$;

revoke all on function public.get_own_calendar_secret(uuid) from public;
grant execute on function public.get_own_calendar_secret(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Calendars within a connection
-- ---------------------------------------------------------------------------
create table if not exists public.external_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid not null
    references public.external_calendar_connections (id) on delete cascade,
  provider_calendar_id text not null,
  name text not null,
  color text null,
  timezone text null,
  enabled boolean not null default true,
  is_primary boolean not null default false,
  sync_token text null,
  ctag text null,
  etag text null,
  last_sync_at timestamptz null,
  last_successful_sync_at timestamptz null,
  last_sync_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_calendars_provider_unique
    unique (connection_id, provider_calendar_id)
);

create index if not exists external_calendars_user_idx
  on public.external_calendars (user_id);

create index if not exists external_calendars_enabled_idx
  on public.external_calendars (user_id, enabled)
  where enabled = true;

drop trigger if exists external_calendars_set_updated_at on public.external_calendars;
create trigger external_calendars_set_updated_at
before update on public.external_calendars
for each row execute function public.set_updated_at();

create or replace function public.enforce_external_calendar_ownership()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
begin
  select user_id into owner
  from public.external_calendar_connections
  where id = new.connection_id;
  if owner is null then
    raise exception 'Not allowed';
  end if;
  if auth.uid() is null then
    if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
      new.user_id := owner;
      return new;
    end if;
    raise exception 'Not allowed';
  end if;
  if auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;
  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists external_calendars_enforce_ownership on public.external_calendars;
create trigger external_calendars_enforce_ownership
before insert or update on public.external_calendars
for each row execute function public.enforce_external_calendar_ownership();

alter table public.external_calendars enable row level security;

drop policy if exists "External calendars select own" on public.external_calendars;
create policy "External calendars select own"
on public.external_calendars for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "External calendars insert own" on public.external_calendars;
create policy "External calendars insert own"
on public.external_calendars for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "External calendars update own" on public.external_calendars;
create policy "External calendars update own"
on public.external_calendars for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "External calendars delete own" on public.external_calendars;
create policy "External calendars delete own"
on public.external_calendars for delete to authenticated
using (auth.uid() = user_id);

revoke all on public.external_calendars from anon;
grant select, insert, update, delete on public.external_calendars to authenticated;

-- ---------------------------------------------------------------------------
-- Mirrored external events
-- ---------------------------------------------------------------------------
create table if not exists public.external_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid not null
    references public.external_calendar_connections (id) on delete cascade,
  calendar_id uuid not null
    references public.external_calendars (id) on delete cascade,
  provider_event_id text not null,
  ical_uid text null,
  recurrence_id text null,
  title text not null default '',
  description text null,
  location text null,
  starts_at timestamptz not null,
  ends_at timestamptz null,
  all_day boolean not null default false,
  timezone text null,
  show_as public.external_event_show_as not null default 'busy',
  status text null,
  is_cancelled boolean not null default false,
  html_link text null,
  recurring boolean not null default false,
  provider_updated_at timestamptz null,
  content_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_calendar_events_provider_unique
    unique (calendar_id, provider_event_id)
);

create index if not exists external_calendar_events_user_range_idx
  on public.external_calendar_events (user_id, starts_at);

create index if not exists external_calendar_events_busy_idx
  on public.external_calendar_events (user_id, starts_at, ends_at)
  where is_cancelled = false and show_as <> 'free';

create index if not exists external_calendar_events_ical_uid_idx
  on public.external_calendar_events (user_id, ical_uid)
  where ical_uid is not null;

drop trigger if exists external_calendar_events_set_updated_at
  on public.external_calendar_events;
create trigger external_calendar_events_set_updated_at
before update on public.external_calendar_events
for each row execute function public.set_updated_at();

create or replace function public.enforce_external_event_ownership()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
  conn uuid;
begin
  select user_id, connection_id into owner, conn
  from public.external_calendars
  where id = new.calendar_id;
  if owner is null then
    raise exception 'Not allowed';
  end if;
  if auth.uid() is null then
    if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
      raise exception 'Not allowed';
    end if;
  elsif auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;
  if new.connection_id is distinct from conn then
    raise exception 'Not allowed';
  end if;
  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists external_calendar_events_enforce_ownership
  on public.external_calendar_events;
create trigger external_calendar_events_enforce_ownership
before insert or update on public.external_calendar_events
for each row execute function public.enforce_external_event_ownership();

alter table public.external_calendar_events enable row level security;

drop policy if exists "External events select own" on public.external_calendar_events;
create policy "External events select own"
on public.external_calendar_events for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "External events insert own" on public.external_calendar_events;
create policy "External events insert own"
on public.external_calendar_events for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "External events update own" on public.external_calendar_events;
create policy "External events update own"
on public.external_calendar_events for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "External events delete own" on public.external_calendar_events;
create policy "External events delete own"
on public.external_calendar_events for delete to authenticated
using (auth.uid() = user_id);

revoke all on public.external_calendar_events from anon;
grant select, insert, update, delete on public.external_calendar_events to authenticated;

-- ---------------------------------------------------------------------------
-- Optional links: external event → native exam/task (or ignored)
-- ---------------------------------------------------------------------------
create table if not exists public.external_event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  external_event_id uuid not null
    references public.external_calendar_events (id) on delete cascade,
  kind public.external_event_link_kind not null,
  assessment_id uuid null references public.assessments (id) on delete set null,
  task_id uuid null references public.tasks (id) on delete set null,
  proposed_title text null,
  proposed_type text null,
  source_fingerprint text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_event_links_event_unique unique (external_event_id),
  constraint external_event_links_target_check check (
    (kind = 'ignored' and assessment_id is null and task_id is null)
    or (kind = 'assessment' and assessment_id is not null and task_id is null)
    or (kind = 'task' and task_id is not null and assessment_id is null)
  )
);

create index if not exists external_event_links_user_idx
  on public.external_event_links (user_id);

drop trigger if exists external_event_links_set_updated_at on public.external_event_links;
create trigger external_event_links_set_updated_at
before update on public.external_event_links
for each row execute function public.set_updated_at();

create or replace function public.enforce_external_event_link_ownership()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
begin
  select user_id into owner
  from public.external_calendar_events
  where id = new.external_event_id;
  if owner is null or auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;
  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists external_event_links_enforce_ownership on public.external_event_links;
create trigger external_event_links_enforce_ownership
before insert or update on public.external_event_links
for each row execute function public.enforce_external_event_link_ownership();

alter table public.external_event_links enable row level security;

drop policy if exists "External event links select own" on public.external_event_links;
create policy "External event links select own"
on public.external_event_links for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "External event links insert own" on public.external_event_links;
create policy "External event links insert own"
on public.external_event_links for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "External event links update own" on public.external_event_links;
create policy "External event links update own"
on public.external_event_links for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "External event links delete own" on public.external_event_links;
create policy "External event links delete own"
on public.external_event_links for delete to authenticated
using (auth.uid() = user_id);

revoke all on public.external_event_links from anon;
grant select, insert, update, delete on public.external_event_links to authenticated;

-- ---------------------------------------------------------------------------
-- OAuth PKCE state (server-only; no authenticated access)
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.external_calendar_provider not null,
  state text not null unique,
  code_verifier text not null,
  redirect_path text not null default '/calendar',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists calendar_oauth_states_expires_idx
  on public.calendar_oauth_states (expires_at);

alter table public.calendar_oauth_states enable row level security;

-- No policies for authenticated/anon — only service role (or security definer) access.
revoke all on public.calendar_oauth_states from anon, authenticated;

create or replace function public.create_calendar_oauth_state(
  p_provider public.external_calendar_provider,
  p_state text,
  p_code_verifier text,
  p_redirect_path text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not allowed';
  end if;
  delete from public.calendar_oauth_states
  where user_id = auth.uid() and provider = p_provider;
  insert into public.calendar_oauth_states (
    user_id, provider, state, code_verifier, redirect_path, expires_at
  ) values (
    auth.uid(), p_provider, p_state, p_code_verifier,
    coalesce(nullif(p_redirect_path, ''), '/calendar'),
    p_expires_at
  )
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.consume_calendar_oauth_state(p_state text)
returns table (
  id uuid,
  user_id uuid,
  provider public.external_calendar_provider,
  code_verifier text,
  redirect_path text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not allowed';
  end if;
  return query
  delete from public.calendar_oauth_states s
  where s.state = p_state
    and s.user_id = auth.uid()
    and s.expires_at > now()
  returning s.id, s.user_id, s.provider, s.code_verifier, s.redirect_path;
end;
$$;

revoke all on function public.create_calendar_oauth_state(
  public.external_calendar_provider, text, text, text, timestamptz
) from public;
revoke all on function public.consume_calendar_oauth_state(text) from public;
grant execute on function public.create_calendar_oauth_state(
  public.external_calendar_provider, text, text, text, timestamptz
) to authenticated;
grant execute on function public.consume_calendar_oauth_state(text) to authenticated;
