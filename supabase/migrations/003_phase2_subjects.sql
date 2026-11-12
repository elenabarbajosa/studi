-- Studi Phase 2: onboarding flags, study preferences, subjects, topics, materials
-- Run AFTER 001_profiles.sql and 002_username_availability.sql.
-- Safe to re-run (idempotent where practical).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'onboarding_status') then
    create type public.onboarding_status as enum (
      'pending',
      'in_progress',
      'skipped',
      'completed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'topic_status') then
    create type public.topic_status as enum (
      'not_started',
      'studying',
      'practicing',
      'mastered'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'resource_type') then
    create type public.resource_type as enum (
      'link',
      'pdf',
      'video',
      'article',
      'notes',
      'other'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles: onboarding progress (additive; preserves existing rows)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarding_status public.onboarding_status
    not null default 'pending';

alter table public.profiles
  add column if not exists onboarding_step smallint not null default 1;

alter table public.profiles
  drop constraint if exists profiles_onboarding_step_range;

alter table public.profiles
  add constraint profiles_onboarding_step_range
  check (onboarding_step between 1 and 3);

-- Existing Phase 1 users already have profiles: mark them skipped so they
-- are not forced through onboarding, but can still visit /onboarding later.
update public.profiles
set onboarding_status = 'skipped'
where onboarding_status = 'pending'
  and created_at < now() - interval '1 minute';

-- ---------------------------------------------------------------------------
-- Study preferences (1:1 with user)
-- ---------------------------------------------------------------------------
create table if not exists public.study_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  weekday_availability jsonb not null default '{
    "mon": true,
    "tue": true,
    "wed": true,
    "thu": true,
    "fri": true,
    "sat": false,
    "sun": false
  }'::jsonb,
  session_duration_minutes integer not null default 50
    check (session_duration_minutes between 15 and 180),
  break_duration_minutes integer not null default 10
    check (break_duration_minutes between 0 and 60),
  weekly_goal_hours numeric(4, 1)
    check (weekly_goal_hours is null or (weekly_goal_hours >= 0 and weekly_goal_hours <= 80)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists study_preferences_set_updated_at on public.study_preferences;
create trigger study_preferences_set_updated_at
before update on public.study_preferences
for each row
execute function public.set_updated_at();

alter table public.study_preferences enable row level security;

drop policy if exists "Study preferences select own" on public.study_preferences;
create policy "Study preferences select own"
on public.study_preferences for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Study preferences insert own" on public.study_preferences;
create policy "Study preferences insert own"
on public.study_preferences for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Study preferences update own" on public.study_preferences;
create policy "Study preferences update own"
on public.study_preferences for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Study preferences delete own" on public.study_preferences;
create policy "Study preferences delete own"
on public.study_preferences for delete to authenticated
using (auth.uid() = user_id);

revoke all on table public.study_preferences from anon;
grant select, insert, update, delete on table public.study_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Subjects
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text not null default 'pink',
  difficulty smallint check (difficulty is null or difficulty between 1 and 5),
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_name_length check (char_length(name) between 1 and 80),
  constraint subjects_description_length check (
    description is null or char_length(description) <= 1000
  ),
  constraint subjects_color_allowed check (
    color in ('pink', 'blue', 'green', 'purple', 'peach', 'neutral', 'rose', 'amber', 'teal', 'indigo')
  )
);

create index if not exists subjects_user_id_sort_idx
  on public.subjects (user_id, sort_order, created_at);

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
before update on public.subjects
for each row
execute function public.set_updated_at();

alter table public.subjects enable row level security;

drop policy if exists "Subjects select own" on public.subjects;
create policy "Subjects select own"
on public.subjects for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Subjects insert own" on public.subjects;
create policy "Subjects insert own"
on public.subjects for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Subjects update own" on public.subjects;
create policy "Subjects update own"
on public.subjects for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Subjects delete own" on public.subjects;
create policy "Subjects delete own"
on public.subjects for delete to authenticated
using (auth.uid() = user_id);

revoke all on table public.subjects from anon;
grant select, insert, update, delete on table public.subjects to authenticated;

-- ---------------------------------------------------------------------------
-- Topics (hierarchical via parent_id)
-- ---------------------------------------------------------------------------
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  parent_id uuid references public.topics (id) on delete cascade,
  title text not null,
  status public.topic_status not null default 'not_started',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_title_length check (char_length(title) between 1 and 120),
  constraint topics_notes_length check (notes is null or char_length(notes) <= 4000),
  constraint topics_no_self_parent check (parent_id is distinct from id)
);

create index if not exists topics_subject_parent_sort_idx
  on public.topics (subject_id, parent_id, sort_order);

create index if not exists topics_user_id_idx
  on public.topics (user_id);

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
before update on public.topics
for each row
execute function public.set_updated_at();

-- Ensure topic.user_id always matches the subject owner.
create or replace function public.enforce_topic_ownership()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.subjects where id = new.subject_id;
  if owner is null then
    raise exception 'Subject not found';
  end if;
  if auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;
  new.user_id := owner;

  if new.parent_id is not null then
    if not exists (
      select 1 from public.topics t
      where t.id = new.parent_id
        and t.subject_id = new.subject_id
        and t.parent_id is null
    ) then
      raise exception 'Invalid parent topic';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists topics_enforce_ownership on public.topics;
create trigger topics_enforce_ownership
before insert or update on public.topics
for each row
execute function public.enforce_topic_ownership();

alter table public.topics enable row level security;

drop policy if exists "Topics select own" on public.topics;
create policy "Topics select own"
on public.topics for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Topics insert own" on public.topics;
create policy "Topics insert own"
on public.topics for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Topics update own" on public.topics;
create policy "Topics update own"
on public.topics for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Topics delete own" on public.topics;
create policy "Topics delete own"
on public.topics for delete to authenticated
using (auth.uid() = user_id);

revoke all on table public.topics from anon;
grant select, insert, update, delete on table public.topics to authenticated;

-- ---------------------------------------------------------------------------
-- Materials
-- ---------------------------------------------------------------------------
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  title text not null,
  resource_type public.resource_type not null default 'link',
  url text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materials_title_length check (char_length(title) between 1 and 120),
  constraint materials_url_length check (char_length(url) between 1 and 2000),
  constraint materials_description_length check (
    description is null or char_length(description) <= 1000
  )
);

create index if not exists materials_subject_idx
  on public.materials (subject_id, created_at desc);

create index if not exists materials_user_id_idx
  on public.materials (user_id);

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at
before update on public.materials
for each row
execute function public.set_updated_at();

create or replace function public.enforce_material_ownership()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.subjects where id = new.subject_id;
  if owner is null or auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;
  new.user_id := owner;

  if new.topic_id is not null then
    if not exists (
      select 1 from public.topics t
      where t.id = new.topic_id and t.subject_id = new.subject_id
    ) then
      raise exception 'Topic does not belong to subject';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists materials_enforce_ownership on public.materials;
create trigger materials_enforce_ownership
before insert or update on public.materials
for each row
execute function public.enforce_material_ownership();

alter table public.materials enable row level security;

drop policy if exists "Materials select own" on public.materials;
create policy "Materials select own"
on public.materials for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Materials insert own" on public.materials;
create policy "Materials insert own"
on public.materials for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Materials update own" on public.materials;
create policy "Materials update own"
on public.materials for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Materials delete own" on public.materials;
create policy "Materials delete own"
on public.materials for delete to authenticated
using (auth.uid() = user_id);

revoke all on table public.materials from anon;
grant select, insert, update, delete on table public.materials to authenticated;
