-- Studi Phase 3: assessments, tasks, calendar events, study sessions
-- Run AFTER 001–003. Do not edit prior migrations.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'assessment_type') then
    create type public.assessment_type as enum (
      'final',
      'midterm',
      'quiz',
      'assignment',
      'project',
      'presentation',
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'priority_level') then
    create type public.priority_level as enum (
      'low',
      'medium',
      'high',
      'critical'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'todo',
      'completed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'study_session_status') then
    create type public.study_session_status as enum (
      'planned',
      'completed',
      'skipped',
      'missed'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Assessments (exams, deadlines, evaluations)
-- ---------------------------------------------------------------------------
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  assessment_type public.assessment_type not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  description text,
  priority public.priority_level not null default 'medium',
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_title_length check (char_length(title) between 1 and 120),
  constraint assessments_location_length check (location is null or char_length(location) <= 200),
  constraint assessments_description_length check (description is null or char_length(description) <= 2000),
  constraint assessments_ends_after_start check (ends_at is null or ends_at >= starts_at)
);

create index if not exists assessments_user_starts_idx
  on public.assessments (user_id, starts_at);
create index if not exists assessments_user_subject_idx
  on public.assessments (user_id, subject_id);

drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at
before update on public.assessments
for each row execute function public.set_updated_at();

create or replace function public.enforce_assessment_ownership()
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
  if new.completed then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_enforce_ownership on public.assessments;
create trigger assessments_enforce_ownership
before insert or update on public.assessments
for each row execute function public.enforce_assessment_ownership();

alter table public.assessments enable row level security;

drop policy if exists "Assessments select own" on public.assessments;
create policy "Assessments select own" on public.assessments
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Assessments insert own" on public.assessments;
create policy "Assessments insert own" on public.assessments
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Assessments update own" on public.assessments;
create policy "Assessments update own" on public.assessments
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Assessments delete own" on public.assessments;
create policy "Assessments delete own" on public.assessments
for delete to authenticated using (auth.uid() = user_id);

revoke all on table public.assessments from anon;
grant select, insert, update, delete on table public.assessments to authenticated;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  priority public.priority_level not null default 'medium',
  estimated_minutes integer check (
    estimated_minutes is null or estimated_minutes between 5 and 600
  ),
  status public.task_status not null default 'todo',
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_length check (char_length(title) between 1 and 160),
  constraint tasks_description_length check (
    description is null or char_length(description) <= 4000
  ),
  constraint tasks_schedule_order check (
    scheduled_end is null
    or scheduled_start is null
    or scheduled_end >= scheduled_start
  )
);

create index if not exists tasks_user_status_due_idx
  on public.tasks (user_id, status, due_at);
create index if not exists tasks_user_subject_idx
  on public.tasks (user_id, subject_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.enforce_task_ownership()
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
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_enforce_ownership on public.tasks;
create trigger tasks_enforce_ownership
before insert or update on public.tasks
for each row execute function public.enforce_task_ownership();

alter table public.tasks enable row level security;

drop policy if exists "Tasks select own" on public.tasks;
create policy "Tasks select own" on public.tasks
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Tasks insert own" on public.tasks;
create policy "Tasks insert own" on public.tasks
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Tasks update own" on public.tasks;
create policy "Tasks update own" on public.tasks
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Tasks delete own" on public.tasks;
create policy "Tasks delete own" on public.tasks
for delete to authenticated using (auth.uid() = user_id);

revoke all on table public.tasks from anon;
grant select, insert, update, delete on table public.tasks to authenticated;

-- ---------------------------------------------------------------------------
-- Subtasks
-- ---------------------------------------------------------------------------
create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subtasks_title_length check (char_length(title) between 1 and 160)
);

create index if not exists subtasks_task_sort_idx
  on public.subtasks (task_id, sort_order);

drop trigger if exists subtasks_set_updated_at on public.subtasks;
create trigger subtasks_set_updated_at
before update on public.subtasks
for each row execute function public.set_updated_at();

create or replace function public.enforce_subtask_ownership()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.tasks where id = new.task_id;
  if owner is null or auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;
  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists subtasks_enforce_ownership on public.subtasks;
create trigger subtasks_enforce_ownership
before insert or update on public.subtasks
for each row execute function public.enforce_subtask_ownership();

alter table public.subtasks enable row level security;

drop policy if exists "Subtasks select own" on public.subtasks;
create policy "Subtasks select own" on public.subtasks
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Subtasks insert own" on public.subtasks;
create policy "Subtasks insert own" on public.subtasks
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Subtasks update own" on public.subtasks;
create policy "Subtasks update own" on public.subtasks
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Subtasks delete own" on public.subtasks;
create policy "Subtasks delete own" on public.subtasks
for delete to authenticated using (auth.uid() = user_id);

revoke all on table public.subtasks from anon;
grant select, insert, update, delete on table public.subtasks to authenticated;

-- ---------------------------------------------------------------------------
-- Personal calendar events (fixed commitments for Phase 4 planning)
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_title_length check (char_length(title) between 1 and 120),
  constraint calendar_events_description_length check (
    description is null or char_length(description) <= 2000
  ),
  constraint calendar_events_ends_after_start check (
    ends_at is null or ends_at >= starts_at
  )
);

create index if not exists calendar_events_user_starts_idx
  on public.calendar_events (user_id, starts_at);

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

create or replace function public.enforce_calendar_event_ownership()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is distinct from new.user_id then
    raise exception 'Not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_events_enforce_ownership on public.calendar_events;
create trigger calendar_events_enforce_ownership
before insert or update on public.calendar_events
for each row execute function public.enforce_calendar_event_ownership();

alter table public.calendar_events enable row level security;

drop policy if exists "Calendar events select own" on public.calendar_events;
create policy "Calendar events select own" on public.calendar_events
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Calendar events insert own" on public.calendar_events;
create policy "Calendar events insert own" on public.calendar_events
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Calendar events update own" on public.calendar_events;
create policy "Calendar events update own" on public.calendar_events
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Calendar events delete own" on public.calendar_events;
create policy "Calendar events delete own" on public.calendar_events
for delete to authenticated using (auth.uid() = user_id);

revoke all on table public.calendar_events from anon;
grant select, insert, update, delete on table public.calendar_events to authenticated;

-- ---------------------------------------------------------------------------
-- Study sessions (flexible blocks; Focus timer will attach in Phase 5)
-- ---------------------------------------------------------------------------
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  planned_duration_minutes integer not null
    check (planned_duration_minutes between 5 and 600),
  status public.study_session_status not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_ends_after_start check (ends_at > starts_at),
  constraint study_sessions_notes_length check (
    notes is null or char_length(notes) <= 2000
  )
);

create index if not exists study_sessions_user_starts_idx
  on public.study_sessions (user_id, starts_at);
create index if not exists study_sessions_user_status_idx
  on public.study_sessions (user_id, status);

drop trigger if exists study_sessions_set_updated_at on public.study_sessions;
create trigger study_sessions_set_updated_at
before update on public.study_sessions
for each row execute function public.set_updated_at();

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
  -- Derive planned duration from window when not provided consistently.
  new.planned_duration_minutes := greatest(
    5,
    round(extract(epoch from (new.ends_at - new.starts_at)) / 60)::integer
  );
  return new;
end;
$$;

drop trigger if exists study_sessions_enforce_ownership on public.study_sessions;
create trigger study_sessions_enforce_ownership
before insert or update on public.study_sessions
for each row execute function public.enforce_study_session_ownership();

alter table public.study_sessions enable row level security;

drop policy if exists "Study sessions select own" on public.study_sessions;
create policy "Study sessions select own" on public.study_sessions
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Study sessions insert own" on public.study_sessions;
create policy "Study sessions insert own" on public.study_sessions
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Study sessions update own" on public.study_sessions;
create policy "Study sessions update own" on public.study_sessions
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Study sessions delete own" on public.study_sessions;
create policy "Study sessions delete own" on public.study_sessions
for delete to authenticated using (auth.uid() = user_id);

revoke all on table public.study_sessions from anon;
grant select, insert, update, delete on table public.study_sessions to authenticated;
