-- Studi: Harden external calendar security (AFTER 018)
-- Do NOT apply automatically. Preserves existing connections/calendars/events/links.
--
-- Fixes:
-- 1) Revoke client access to encrypted secrets (table DML + get_own_calendar_secret)
-- 2) Enforce secret.user_id = connection.user_id
-- 3) Enforce external_event_links cannot reference another user's assessment/task
-- 4) Harden OAuth state (safe redirects, bounded expiry); revoke client RPC execute
-- 5) Keep service_role able to sync/write under ownership triggers
--
-- Application must use SUPABASE_SERVICE_ROLE_KEY for secret + OAuth-state access.

-- ---------------------------------------------------------------------------
-- Preflight: refuse to proceed if ownership is already inconsistent
-- (fail safely — do not silently delete or reassign user data)
-- ---------------------------------------------------------------------------
do $$
declare
  bad_links bigint;
  bad_secrets bigint;
begin
  select count(*) into bad_links
  from public.external_event_links l
  where
    (
      l.assessment_id is not null
      and not exists (
        select 1 from public.assessments a
        where a.id = l.assessment_id and a.user_id = l.user_id
      )
    )
    or (
      l.task_id is not null
      and not exists (
        select 1 from public.tasks t
        where t.id = l.task_id and t.user_id = l.user_id
      )
    );

  select count(*) into bad_secrets
  from public.external_calendar_secrets s
  join public.external_calendar_connections c on c.id = s.connection_id
  where s.user_id is distinct from c.user_id;

  if bad_links > 0 or bad_secrets > 0 then
    raise exception
      '019_external_calendar_security_hardening preflight failed: % cross-user link(s), % secret ownership mismatch(es). Resolve before applying.',
      bad_links, bad_secrets;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Secrets: service-role only (no authenticated SELECT/INSERT/UPDATE/DELETE)
-- ---------------------------------------------------------------------------
drop policy if exists "External secrets insert own" on public.external_calendar_secrets;
drop policy if exists "External secrets update own" on public.external_calendar_secrets;
drop policy if exists "External secrets delete own" on public.external_calendar_secrets;

revoke all on table public.external_calendar_secrets from anon, authenticated;

-- RLS remains enabled with zero policies → denied for JWT roles; service_role bypasses.
alter table public.external_calendar_secrets enable row level security;

-- Drop client-callable ciphertext RPC.
revoke all on function public.get_own_calendar_secret(uuid) from public, anon, authenticated;
drop function if exists public.get_own_calendar_secret(uuid);

-- Enforce secret.user_id always matches the parent connection owner.
create or replace function public.enforce_external_secret_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public
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

  -- Authenticated writers (if any grant is restored) must own the connection.
  if auth.uid() is not null and auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;

  -- Service role / cascade paths: force ownership alignment.
  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists external_calendar_secrets_enforce_ownership
  on public.external_calendar_secrets;
create trigger external_calendar_secrets_enforce_ownership
before insert or update on public.external_calendar_secrets
for each row execute function public.enforce_external_secret_ownership();

-- ---------------------------------------------------------------------------
-- 2) Event links: validate assessment/task ownership (same user as event)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_external_event_link_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  event_owner uuid;
  assessment_owner uuid;
  task_owner uuid;
begin
  select user_id into event_owner
  from public.external_calendar_events
  where id = new.external_event_id;

  if event_owner is null then
    raise exception 'Not allowed';
  end if;

  if auth.uid() is not null and auth.uid() is distinct from event_owner then
    raise exception 'Not allowed';
  end if;

  new.user_id := event_owner;

  if new.assessment_id is not null then
    select user_id into assessment_owner
    from public.assessments
    where id = new.assessment_id;
    if assessment_owner is null or assessment_owner is distinct from event_owner then
      raise exception 'Not allowed';
    end if;
  end if;

  if new.task_id is not null then
    select user_id into task_owner
    from public.tasks
    where id = new.task_id;
    if task_owner is null or task_owner is distinct from event_owner then
      raise exception 'Not allowed';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger already exists from 018; recreate to pick up the new function body.
drop trigger if exists external_event_links_enforce_ownership on public.external_event_links;
create trigger external_event_links_enforce_ownership
before insert or update on public.external_event_links
for each row execute function public.enforce_external_event_link_ownership();

-- ---------------------------------------------------------------------------
-- 3) OAuth state: revoke client RPCs; harden validators; keep table locked down
-- ---------------------------------------------------------------------------
revoke all on function public.create_calendar_oauth_state(
  public.external_calendar_provider, text, text, text, timestamptz
) from public, anon, authenticated;

revoke all on function public.consume_calendar_oauth_state(text)
  from public, anon, authenticated;

drop function if exists public.create_calendar_oauth_state(
  public.external_calendar_provider, text, text, text, timestamptz
);
drop function if exists public.consume_calendar_oauth_state(text);

-- Safe redirect path: relative, single slash root, no protocol-relative //…
alter table public.calendar_oauth_states
  drop constraint if exists calendar_oauth_states_redirect_safe;

alter table public.calendar_oauth_states
  add constraint calendar_oauth_states_redirect_safe
  check (
    redirect_path = '/'
    or (
      redirect_path like '/%'
      and redirect_path not like '//%'
      and redirect_path !~* '^[a-z][a-z0-9+.-]*:'
    )
  );

-- Bound lifetime: expires_at must be in the future at insert and ≤ 15 minutes from created_at.
create or replace function public.enforce_calendar_oauth_state_bounds()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.state is null or char_length(new.state) < 16 or char_length(new.state) > 256 then
    raise exception 'Invalid OAuth state';
  end if;
  if new.code_verifier is null
     or char_length(new.code_verifier) < 32
     or char_length(new.code_verifier) > 256 then
    raise exception 'Invalid OAuth code verifier';
  end if;

  -- Normalize redirect defensively (app should already pass a safe path).
  if new.redirect_path is null
     or new.redirect_path = ''
     or new.redirect_path like '//%'
     or new.redirect_path !~ '^/' then
    new.redirect_path := '/calendar';
  end if;

  if new.expires_at <= now() then
    raise exception 'OAuth state expiry must be in the future';
  end if;
  if new.expires_at > new.created_at + interval '15 minutes' then
    raise exception 'OAuth state expiry exceeds 15 minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists calendar_oauth_states_enforce_bounds on public.calendar_oauth_states;
create trigger calendar_oauth_states_enforce_bounds
before insert or update on public.calendar_oauth_states
for each row execute function public.enforce_calendar_oauth_state_bounds();

-- Ensure table remains inaccessible to JWT clients.
alter table public.calendar_oauth_states enable row level security;
revoke all on table public.calendar_oauth_states from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Ownership triggers: explicit search_path; keep service_role sync path
-- ---------------------------------------------------------------------------
create or replace function public.enforce_external_connection_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
      return new;
    end if;
    raise exception 'Not allowed';
  end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  elsif new.user_id is distinct from old.user_id
     or new.user_id is distinct from auth.uid() then
    raise exception 'Not allowed';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_external_calendar_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public
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

create or replace function public.enforce_external_event_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public
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
