-- Studi Phase 5: Focus Mode, Pomodoro tracking, and study statistics
-- Run AFTER 001–005. Do not edit prior migrations.
--
-- Design notes:
-- - Completed focus runs are stored on public.study_sessions (extended), not a parallel history table.
-- - Live / recoverable timer state lives in public.focus_active_sessions (at most one per user).
-- - Breaks never count toward focus_seconds.
-- - client_session_id prevents duplicate saves from refresh/retry.

-- ---------------------------------------------------------------------------
-- Extend study_session_status for interrupted focus runs (optional use)
-- Run these first if your SQL editor wraps the whole script in one transaction
-- and complains about using a new enum value in the same transaction.
-- ---------------------------------------------------------------------------
alter type public.study_session_status add value if not exists 'in_progress';
alter type public.study_session_status add value if not exists 'interrupted';

-- ---------------------------------------------------------------------------
-- Timer / source enums (new types — safe in same migration)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'focus_timer_mode') then
    create type public.focus_timer_mode as enum ('pomodoro', 'stopwatch');
  end if;
  if not exists (select 1 from pg_type where typname = 'study_session_source') then
    create type public.study_session_source as enum ('calendar', 'focus');
  end if;
  if not exists (select 1 from pg_type where typname = 'soundscape_id') then
    create type public.soundscape_id as enum (
      'silence',
      'rain',
      'cafe',
      'white_noise',
      'forest'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Extend study_sessions for actual focus tracking
-- ---------------------------------------------------------------------------
alter table public.study_sessions
  alter column ends_at drop not null;

alter table public.study_sessions
  drop constraint if exists study_sessions_ends_after_start;

alter table public.study_sessions
  add constraint study_sessions_ends_after_start
  check (ends_at is null or ends_at > starts_at);

alter table public.study_sessions
  add column if not exists source public.study_session_source not null default 'calendar',
  add column if not exists timer_mode public.focus_timer_mode,
  add column if not exists focus_seconds integer not null default 0
    check (focus_seconds >= 0 and focus_seconds <= 86400),
  add column if not exists break_seconds integer not null default 0
    check (break_seconds >= 0 and break_seconds <= 86400),
  add column if not exists goal text,
  add column if not exists goal_completed boolean,
  add column if not exists client_session_id uuid,
  add column if not exists pomodoro_cycles integer not null default 0
    check (pomodoro_cycles >= 0 and pomodoro_cycles <= 48);

alter table public.study_sessions
  drop constraint if exists study_sessions_goal_length;
alter table public.study_sessions
  add constraint study_sessions_goal_length
  check (goal is null or char_length(goal) <= 200);

-- Idempotent finish: one saved row per client session id per user
create unique index if not exists study_sessions_user_client_session_uidx
  on public.study_sessions (user_id, client_session_id)
  where client_session_id is not null;

create index if not exists study_sessions_user_focus_completed_idx
  on public.study_sessions (user_id, starts_at desc)
  where source = 'focus' and status = 'completed';

-- Ownership trigger: allow null ends_at for in-progress; derive planned duration safely
create or replace function public.enforce_study_session_ownership()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is distinct from new.user_id then
    raise exception 'Not allowed';
  end if;
  if new.subject_id is not null then
    if not exists (
      select 1 from public.subjects s
      where s.id = new.subject_id and s.user_id = new.user_id
    ) then
      raise exception 'Subject does not belong to user';
    end if;
  end if;
  if new.topic_id is not null then
    if not exists (
      select 1 from public.topics t
      where t.id = new.topic_id
        and t.user_id = new.user_id
        and (new.subject_id is null or t.subject_id = new.subject_id)
    ) then
      raise exception 'Topic does not belong to user/subject';
    end if;
  end if;
  if new.task_id is not null then
    if not exists (
      select 1 from public.tasks tk
      where tk.id = new.task_id and tk.user_id = new.user_id
    ) then
      raise exception 'Task does not belong to user';
    end if;
  end if;

  if new.ends_at is not null then
    new.planned_duration_minutes := greatest(
      5,
      round(extract(epoch from (new.ends_at - new.starts_at)) / 60)::integer
    );
  elsif new.planned_duration_minutes is null or new.planned_duration_minutes < 5 then
    new.planned_duration_minutes := 25;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Live focus session (recovery / heartbeat). Max one active row per user.
-- ---------------------------------------------------------------------------
create table if not exists public.focus_active_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  client_session_id uuid not null,
  timer_mode public.focus_timer_mode not null,
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  goal text,
  -- Pure timer engine snapshot (phase, anchors, accumulated seconds, etc.)
  engine_state jsonb not null default '{}'::jsonb,
  focus_seconds integer not null default 0
    check (focus_seconds >= 0 and focus_seconds <= 86400),
  break_seconds integer not null default 0
    check (break_seconds >= 0 and break_seconds <= 86400),
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint focus_active_goal_length check (goal is null or char_length(goal) <= 200)
);

create index if not exists focus_active_sessions_heartbeat_idx
  on public.focus_active_sessions (last_heartbeat_at);

drop trigger if exists focus_active_sessions_set_updated_at on public.focus_active_sessions;
create trigger focus_active_sessions_set_updated_at
before update on public.focus_active_sessions
for each row execute function public.set_updated_at();

create or replace function public.enforce_focus_active_ownership()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is distinct from new.user_id then
    raise exception 'Not allowed';
  end if;
  if new.subject_id is not null then
    if not exists (
      select 1 from public.subjects s
      where s.id = new.subject_id and s.user_id = new.user_id
    ) then
      raise exception 'Subject does not belong to user';
    end if;
  end if;
  if new.topic_id is not null then
    if not exists (
      select 1 from public.topics t
      where t.id = new.topic_id
        and t.user_id = new.user_id
        and (new.subject_id is null or t.subject_id = new.subject_id)
    ) then
      raise exception 'Topic does not belong to user/subject';
    end if;
  end if;
  if new.task_id is not null then
    if not exists (
      select 1 from public.tasks tk
      where tk.id = new.task_id and tk.user_id = new.user_id
    ) then
      raise exception 'Task does not belong to user';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists focus_active_sessions_enforce_ownership on public.focus_active_sessions;
create trigger focus_active_sessions_enforce_ownership
before insert or update on public.focus_active_sessions
for each row execute function public.enforce_focus_active_ownership();

alter table public.focus_active_sessions enable row level security;

drop policy if exists "Focus active select own" on public.focus_active_sessions;
create policy "Focus active select own" on public.focus_active_sessions
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Focus active insert own" on public.focus_active_sessions;
create policy "Focus active insert own" on public.focus_active_sessions
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Focus active update own" on public.focus_active_sessions;
create policy "Focus active update own" on public.focus_active_sessions
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Focus active delete own" on public.focus_active_sessions;
create policy "Focus active delete own" on public.focus_active_sessions
for delete to authenticated using (auth.uid() = user_id);

revoke all on table public.focus_active_sessions from anon;
grant select, insert, update, delete on table public.focus_active_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Pomodoro + soundscape preferences (extend study_preferences)
-- ---------------------------------------------------------------------------
alter table public.study_preferences
  add column if not exists pomodoro_focus_minutes integer not null default 25
    check (pomodoro_focus_minutes between 5 and 120),
  add column if not exists pomodoro_short_break_minutes integer not null default 5
    check (pomodoro_short_break_minutes between 1 and 30),
  add column if not exists pomodoro_long_break_minutes integer not null default 15
    check (pomodoro_long_break_minutes between 5 and 60),
  add column if not exists pomodoro_intervals_before_long integer not null default 4
    check (pomodoro_intervals_before_long between 2 and 8),
  add column if not exists auto_start_breaks boolean not null default false,
  add column if not exists focus_sound_enabled boolean not null default true,
  add column if not exists soundscape_primary public.soundscape_id not null default 'silence',
  add column if not exists soundscape_secondary public.soundscape_id not null default 'silence',
  add column if not exists soundscape_volume real not null default 0.45
    check (soundscape_volume >= 0 and soundscape_volume <= 1),
  add column if not exists soundscape_secondary_volume real not null default 0
    check (soundscape_secondary_volume >= 0 and soundscape_secondary_volume <= 1);

comment on table public.focus_active_sessions is
  'At-most-one live Focus timer per user for recovery. Authoritative room clocks come later for Study Together.';
comment on column public.study_sessions.focus_seconds is
  'Actual active focus time only; breaks are excluded.';
comment on column public.study_sessions.client_session_id is
  'Client-generated UUID for idempotent session saves.';
