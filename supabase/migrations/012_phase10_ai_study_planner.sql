-- Studi Phase 10: AI Study Planner — preferences, plan metadata, generation sessions
-- Run AFTER 001–011. Do NOT apply automatically from the app.
--
-- Apply in the Supabase SQL editor or via CLI before using Generate study plan.
-- Without this migration, planner AI actions return a clear setup error.
--
-- Design notes:
-- - Planned sessions still live in study_sessions (source=calendar, status=planned).
-- - study_plans / study_plan_sessions track plan membership and locked edits.
-- - planner_preferences are separate from focus Pomodoro settings.
-- - AI rate limits reuse claim_ai_usage with feature 'study_plan'.
-- - ai_generation_sessions provides subject-free one-shot tokens for generate→save.

-- ---------------------------------------------------------------------------
-- Planner preferences (per user)
-- ---------------------------------------------------------------------------

create table if not exists public.planner_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  planning_period text not null default '14',
  intensity text not null default 'balanced',
  max_hours_per_day numeric(3,1) not null default 4.0,
  preferred_session_minutes int not null default 50,
  break_minutes int not null default 10,
  include_revision boolean not null default true,
  include_incomplete_tasks boolean not null default true,
  weekday_availability jsonb not null default '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false}'::jsonb,
  time_windows jsonb not null default '{"mon":[{"start":"09:00","end":"12:00"},{"start":"14:00","end":"18:00"}],"tue":[{"start":"09:00","end":"12:00"},{"start":"14:00","end":"18:00"}],"wed":[{"start":"09:00","end":"12:00"},{"start":"14:00","end":"18:00"}],"thu":[{"start":"09:00","end":"12:00"},{"start":"14:00","end":"18:00"}],"fri":[{"start":"09:00","end":"12:00"},{"start":"14:00","end":"18:00"}],"sat":[],"sun":[]}'::jsonb,
  rest_days text[] not null default '{}',
  included_subject_ids uuid[] null,
  prioritized_topic_ids uuid[] not null default '{}',
  excluded_topic_ids uuid[] not null default '{}',
  until_assessment_id uuid null references public.assessments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_preferences_period_check check (planning_period in ('7', '14', '30', 'until_exam')),
  constraint planner_preferences_intensity_check check (intensity in ('light', 'balanced', 'intensive')),
  constraint planner_preferences_max_hours_check check (max_hours_per_day >= 0.5 and max_hours_per_day <= 12),
  constraint planner_preferences_session_check check (preferred_session_minutes between 15 and 180),
  constraint planner_preferences_break_check check (break_minutes between 0 and 60)
);

alter table public.planner_preferences enable row level security;

drop policy if exists planner_preferences_select_own on public.planner_preferences;
create policy planner_preferences_select_own
  on public.planner_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists planner_preferences_insert_own on public.planner_preferences;
create policy planner_preferences_insert_own
  on public.planner_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists planner_preferences_update_own on public.planner_preferences;
create policy planner_preferences_update_own
  on public.planner_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists planner_preferences_delete_own on public.planner_preferences;
create policy planner_preferences_delete_own
  on public.planner_preferences for delete to authenticated
  using (auth.uid() = user_id);

revoke all on table public.planner_preferences from public, anon;
grant select, insert, update, delete on table public.planner_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Study plans
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'study_plan_status') then
    create type public.study_plan_status as enum (
      'draft',
      'active',
      'completed',
      'archived'
    );
  end if;
end $$;

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Study plan',
  status public.study_plan_status not null default 'active',
  period_start date not null,
  period_end date not null,
  intensity text not null default 'balanced',
  timezone text not null default 'UTC',
  summary text null,
  recommendations jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  generation_session_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_plans_period_check check (period_end >= period_start),
  constraint study_plans_title_check check (char_length(title) between 1 and 120)
);

create index if not exists study_plans_user_status_idx
  on public.study_plans (user_id, status, created_at desc);

create table if not exists public.study_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  study_session_id uuid not null references public.study_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  locked boolean not null default false,
  user_edited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (plan_id, study_session_id)
);

create index if not exists study_plan_sessions_plan_idx
  on public.study_plan_sessions (plan_id);

create index if not exists study_plan_sessions_session_idx
  on public.study_plan_sessions (study_session_id);

alter table public.study_plans enable row level security;
alter table public.study_plan_sessions enable row level security;

drop policy if exists study_plans_select_own on public.study_plans;
create policy study_plans_select_own
  on public.study_plans for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists study_plans_insert_own on public.study_plans;
create policy study_plans_insert_own
  on public.study_plans for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists study_plans_update_own on public.study_plans;
create policy study_plans_update_own
  on public.study_plans for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists study_plans_delete_own on public.study_plans;
create policy study_plans_delete_own
  on public.study_plans for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists study_plan_sessions_select_own on public.study_plan_sessions;
create policy study_plan_sessions_select_own
  on public.study_plan_sessions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists study_plan_sessions_insert_own on public.study_plan_sessions;
create policy study_plan_sessions_insert_own
  on public.study_plan_sessions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists study_plan_sessions_update_own on public.study_plan_sessions;
create policy study_plan_sessions_update_own
  on public.study_plan_sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists study_plan_sessions_delete_own on public.study_plan_sessions;
create policy study_plan_sessions_delete_own
  on public.study_plan_sessions for delete to authenticated
  using (auth.uid() = user_id);

revoke all on table public.study_plans from public, anon;
revoke all on table public.study_plan_sessions from public, anon;
grant select, insert, update, delete on table public.study_plans to authenticated;
grant select, insert, update, delete on table public.study_plan_sessions to authenticated;

-- Ownership trigger: plan session user must match plan + study session owner
create or replace function public.enforce_study_plan_session_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_user uuid;
  v_session_user uuid;
begin
  select user_id into v_plan_user from public.study_plans where id = new.plan_id;
  select user_id into v_session_user from public.study_sessions where id = new.study_session_id;
  if v_plan_user is null or v_session_user is null or v_plan_user <> v_session_user then
    raise exception 'plan session ownership mismatch';
  end if;
  new.user_id := v_plan_user;
  return new;
end;
$$;

drop trigger if exists trg_study_plan_session_ownership on public.study_plan_sessions;
create trigger trg_study_plan_session_ownership
  before insert or update on public.study_plan_sessions
  for each row execute function public.enforce_study_plan_session_ownership();

-- ---------------------------------------------------------------------------
-- AI generation sessions (subject-free; for study_plan feature)
-- ---------------------------------------------------------------------------

create table if not exists public.ai_generation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  constraint ai_generation_sessions_feature_check check (char_length(feature) between 1 and 64)
);

create index if not exists ai_generation_sessions_user_idx
  on public.ai_generation_sessions (user_id, feature, created_at desc);

alter table public.ai_generation_sessions enable row level security;

drop policy if exists ai_generation_sessions_select_own on public.ai_generation_sessions;
create policy ai_generation_sessions_select_own
  on public.ai_generation_sessions for select to authenticated
  using (auth.uid() = user_id);

revoke all on table public.ai_generation_sessions from public, anon;
grant select on table public.ai_generation_sessions to authenticated;

create or replace function public.create_ai_generation_session(p_feature text)
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
  if p_feature is null or length(trim(p_feature)) = 0 then
    raise exception 'feature required';
  end if;

  insert into public.ai_generation_sessions (user_id, feature, expires_at)
  values (v_uid, trim(p_feature), now() + interval '24 hours')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.consume_ai_generation_session(
  p_session_id uuid,
  p_feature text
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

  update public.ai_generation_sessions s
  set consumed_at = now()
  where s.id = p_session_id
    and s.user_id = v_uid
    and s.feature = p_feature
    and s.consumed_at is null
    and s.expires_at > now();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.create_ai_generation_session(text) from public, anon;
revoke all on function public.consume_ai_generation_session(uuid, text) from public, anon;
grant execute on function public.create_ai_generation_session(text) to authenticated;
grant execute on function public.consume_ai_generation_session(uuid, text) to authenticated;

comment on function public.create_ai_generation_session(text) is
  'Creates a one-shot AI generation session for the authenticated user (e.g. study_plan).';
comment on function public.consume_ai_generation_session(uuid, text) is
  'Consumes an unused generation session. Returns false if already used or invalid.';
