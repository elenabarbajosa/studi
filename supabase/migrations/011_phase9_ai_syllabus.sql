-- Studi Phase 9: AI syllabus import — daily usage limits + one-shot import sessions
-- Run AFTER 001–010. Do NOT apply automatically from the app.
--
-- Apply in the Supabase SQL editor or via CLI before using Import with AI
-- in a shared environment. Without this migration, extract actions return:
-- "AI usage tracking is not set up yet."
--
-- Design notes:
-- - Rate limit is shared across concurrent serverless instances (Postgres, not memory).
-- - claim_ai_usage inserts a row only when under the daily limit (atomic).
-- - Import sessions prevent duplicate submissions of the same extract→import flow.
-- - Uploaded PDFs are NEVER stored; only usage/session metadata is persisted.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now(),
  constraint ai_usage_events_feature_check check (char_length(feature) between 1 and 64)
);

create index if not exists ai_usage_events_user_feature_day_idx
  on public.ai_usage_events (user_id, feature, created_at desc);

create table if not exists public.ai_import_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  feature text not null default 'syllabus_import',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  constraint ai_import_sessions_feature_check check (char_length(feature) between 1 and 64)
);

create index if not exists ai_import_sessions_user_idx
  on public.ai_import_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ai_usage_events enable row level security;
alter table public.ai_import_sessions enable row level security;

drop policy if exists ai_usage_events_select_own on public.ai_usage_events;
create policy ai_usage_events_select_own
  on public.ai_usage_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists ai_import_sessions_select_own on public.ai_import_sessions;
create policy ai_import_sessions_select_own
  on public.ai_import_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.ai_usage_events from public, anon;
revoke all on table public.ai_import_sessions from public, anon;
grant select on table public.ai_usage_events to authenticated;
grant select on table public.ai_import_sessions to authenticated;

-- Inserts happen only through security-definer RPCs.

-- ---------------------------------------------------------------------------
-- claim_ai_usage: atomic daily counter
-- ---------------------------------------------------------------------------

create or replace function public.claim_ai_usage(
  p_feature text,
  p_daily_limit int default 3
)
returns table (allowed boolean, used int, "limit" int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_used int;
  v_limit int := greatest(coalesce(p_daily_limit, 3), 0);
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_feature is null or length(trim(p_feature)) = 0 then
    raise exception 'feature required';
  end if;

  -- Serialize claims per user+feature for the day.
  perform pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_feature));

  select count(*)::int into v_used
  from public.ai_usage_events e
  where e.user_id = v_uid
    and e.feature = p_feature
    and e.created_at >= (timezone('utc', now()))::date
    and e.created_at < ((timezone('utc', now()))::date + 1);

  if v_used >= v_limit then
    return query select false, v_used, v_limit;
    return;
  end if;

  insert into public.ai_usage_events (user_id, feature)
  values (v_uid, p_feature);

  v_used := v_used + 1;
  return query select true, v_used, v_limit;
end;
$$;

revoke all on function public.claim_ai_usage(text, int) from public, anon;
grant execute on function public.claim_ai_usage(text, int) to authenticated;

comment on function public.claim_ai_usage(text, int) is
  'Atomically claims one AI usage unit for the current user/feature for the UTC day.';

-- ---------------------------------------------------------------------------
-- Import sessions
-- ---------------------------------------------------------------------------

create or replace function public.create_ai_import_session(
  p_subject_id uuid,
  p_feature text default 'syllabus_import'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.subjects s
    where s.id = p_subject_id and s.user_id = v_uid
  ) then
    raise exception 'subject not found';
  end if;

  insert into public.ai_import_sessions (user_id, subject_id, feature, expires_at)
  values (v_uid, p_subject_id, coalesce(nullif(trim(p_feature), ''), 'syllabus_import'), now() + interval '24 hours')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.consume_ai_import_session(
  p_session_id uuid,
  p_subject_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.ai_import_sessions s
  set consumed_at = now()
  where s.id = p_session_id
    and s.user_id = v_uid
    and s.subject_id = p_subject_id
    and s.consumed_at is null
    and s.expires_at > now();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.create_ai_import_session(uuid, text) from public, anon;
revoke all on function public.consume_ai_import_session(uuid, uuid) from public, anon;
grant execute on function public.create_ai_import_session(uuid, text) to authenticated;
grant execute on function public.consume_ai_import_session(uuid, uuid) to authenticated;

comment on function public.create_ai_import_session(uuid, text) is
  'Creates a one-shot import session for the authenticated subject owner.';
comment on function public.consume_ai_import_session(uuid, uuid) is
  'Consumes an unused, unexpired import session. Returns false if already used or invalid.';
