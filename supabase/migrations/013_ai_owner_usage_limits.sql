-- Studi: owner-aware AI daily limits
-- Run AFTER 011 (and 012 if using the planner). Do NOT apply automatically.
--
-- After applying, set your owner UUID (do not leave null in production):
--
--   select id, email from auth.users where email = 'elenabarbajosa@gmail.com';
--   update public.studi_ai_owner
--     set owner_user_id = '<uuid-from-query>',
--         updated_at = now()
--     where id = true;
--
-- Also set STUDI_OWNER_USER_ID in the Next.js server env to the same UUID
-- (used for UI messaging; the RPC below is the authoritative enforcer).
--
-- Security: claim_ai_usage no longer trusts client-supplied p_daily_limit for
-- privilege. Limits are resolved from this table using auth.uid().

create table if not exists public.studi_ai_owner (
  id boolean primary key default true check (id),
  owner_user_id uuid null,
  owner_daily_limit int not null default 100
    check (owner_daily_limit >= 1 and owner_daily_limit <= 10000),
  standard_daily_limit int not null default 3
    check (standard_daily_limit >= 0 and standard_daily_limit <= 1000),
  updated_at timestamptz not null default now()
);

insert into public.studi_ai_owner (id, owner_user_id, owner_daily_limit, standard_daily_limit)
values (true, null, 100, 3)
on conflict (id) do nothing;

alter table public.studi_ai_owner enable row level security;

-- No policies for authenticated/anon → deny direct table access.
revoke all on table public.studi_ai_owner from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resolve daily limit for the current auth user (read-only)
-- ---------------------------------------------------------------------------

create or replace function public.get_ai_daily_limit()
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_owner_limit int;
  v_standard int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select owner_user_id, owner_daily_limit, standard_daily_limit
    into v_owner, v_owner_limit, v_standard
  from public.studi_ai_owner
  where id = true;

  if v_owner is not null and v_uid = v_owner then
    return coalesce(v_owner_limit, 100);
  end if;

  return coalesce(v_standard, 3);
end;
$$;

revoke all on function public.get_ai_daily_limit() from public, anon;
grant execute on function public.get_ai_daily_limit() to authenticated;

comment on function public.get_ai_daily_limit() is
  'Returns the AI daily request limit for the authenticated user (owner vs standard).';

-- ---------------------------------------------------------------------------
-- claim_ai_usage: ignore client-supplied privilege; enforce from config
-- p_daily_limit is retained for API compatibility but is ignored.
-- ---------------------------------------------------------------------------

create or replace function public.claim_ai_usage(
  p_feature text,
  p_daily_limit int default null
)
returns table (allowed boolean, used int, "limit" int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_used int;
  v_limit int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_feature is null or length(trim(p_feature)) = 0 then
    raise exception 'feature required';
  end if;

  -- Authoritative limit (never trust client p_daily_limit).
  v_limit := public.get_ai_daily_limit();

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
  'Atomically claims one AI usage unit. Daily limit is resolved server-side for owner vs standard users; p_daily_limit is ignored.';
