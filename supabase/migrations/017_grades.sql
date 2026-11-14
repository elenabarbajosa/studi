-- Studi: Grades & What-If calculator
-- Run AFTER 001–016. Do NOT apply automatically from the app.
--
-- Tables:
--   subject_grade_schemes — per-subject grading config + pass rules
--   grade_groups          — optional weighted groups
--   grade_components      — assessments in the scheme (weights + actual scores)
--
-- Actual scores live on grade_components.score (null = pending).
-- What-If / required-grade scenarios are client-session only (not persisted).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'grade_component_type') then
    create type public.grade_component_type as enum (
      'midterm',
      'final',
      'quiz',
      'assignment',
      'project',
      'lab',
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'grade_scheme_status') then
    create type public.grade_scheme_status as enum ('draft', 'complete');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Schemes
-- ---------------------------------------------------------------------------
create table if not exists public.subject_grade_schemes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  display_scale_max numeric(12, 4) not null default 100
    check (display_scale_max > 0),
  -- Normalized 0–100 pass mark (null = no overall requirement)
  passing_overall numeric(8, 4) null
    check (passing_overall is null or (passing_overall >= 0 and passing_overall <= 100)),
  -- Normalized 0–100 minimum on every final-type component
  passing_final_min numeric(8, 4) null
    check (passing_final_min is null or (passing_final_min >= 0 and passing_final_min <= 100)),
  status public.grade_scheme_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subject_grade_schemes_subject_unique unique (subject_id)
);

create index if not exists subject_grade_schemes_user_idx
  on public.subject_grade_schemes (user_id);

drop trigger if exists subject_grade_schemes_set_updated_at on public.subject_grade_schemes;
create trigger subject_grade_schemes_set_updated_at
before update on public.subject_grade_schemes
for each row execute function public.set_updated_at();

create or replace function public.enforce_grade_scheme_ownership()
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
  return new;
end;
$$;

drop trigger if exists subject_grade_schemes_enforce_ownership on public.subject_grade_schemes;
create trigger subject_grade_schemes_enforce_ownership
before insert or update on public.subject_grade_schemes
for each row execute function public.enforce_grade_scheme_ownership();

alter table public.subject_grade_schemes enable row level security;

drop policy if exists "Grade schemes select own" on public.subject_grade_schemes;
create policy "Grade schemes select own"
on public.subject_grade_schemes for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Grade schemes insert own" on public.subject_grade_schemes;
create policy "Grade schemes insert own"
on public.subject_grade_schemes for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Grade schemes update own" on public.subject_grade_schemes;
create policy "Grade schemes update own"
on public.subject_grade_schemes for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Grade schemes delete own" on public.subject_grade_schemes;
create policy "Grade schemes delete own"
on public.subject_grade_schemes for delete to authenticated
using (auth.uid() = user_id);

revoke all on table public.subject_grade_schemes from anon;
grant select, insert, update, delete on table public.subject_grade_schemes to authenticated;

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------
create table if not exists public.grade_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  scheme_id uuid not null references public.subject_grade_schemes (id) on delete cascade,
  title text not null,
  weight_percent numeric(8, 4) not null default 0
    check (weight_percent >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_groups_title_length check (char_length(title) between 1 and 120)
);

create index if not exists grade_groups_scheme_idx
  on public.grade_groups (scheme_id, sort_order);

drop trigger if exists grade_groups_set_updated_at on public.grade_groups;
create trigger grade_groups_set_updated_at
before update on public.grade_groups
for each row execute function public.set_updated_at();

create or replace function public.enforce_grade_group_ownership()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
  scheme_subject uuid;
begin
  select user_id, subject_id into owner, scheme_subject
  from public.subject_grade_schemes where id = new.scheme_id;
  if owner is null or auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;
  if new.subject_id is distinct from scheme_subject then
    raise exception 'Group subject must match scheme';
  end if;
  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists grade_groups_enforce_ownership on public.grade_groups;
create trigger grade_groups_enforce_ownership
before insert or update on public.grade_groups
for each row execute function public.enforce_grade_group_ownership();

alter table public.grade_groups enable row level security;

drop policy if exists "Grade groups select own" on public.grade_groups;
create policy "Grade groups select own"
on public.grade_groups for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Grade groups insert own" on public.grade_groups;
create policy "Grade groups insert own"
on public.grade_groups for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Grade groups update own" on public.grade_groups;
create policy "Grade groups update own"
on public.grade_groups for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Grade groups delete own" on public.grade_groups;
create policy "Grade groups delete own"
on public.grade_groups for delete to authenticated
using (auth.uid() = user_id);

revoke all on table public.grade_groups from anon;
grant select, insert, update, delete on table public.grade_groups to authenticated;

-- ---------------------------------------------------------------------------
-- Components
-- ---------------------------------------------------------------------------
create table if not exists public.grade_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  scheme_id uuid not null references public.subject_grade_schemes (id) on delete cascade,
  group_id uuid null references public.grade_groups (id) on delete set null,
  title text not null,
  component_type public.grade_component_type not null default 'other',
  -- Standalone weight toward final (used when group_id is null)
  weight_percent numeric(8, 4) not null default 0
    check (weight_percent >= 0),
  -- Relative weight inside a group (sums to 100 within the group)
  weight_within_group numeric(8, 4) null
    check (weight_within_group is null or weight_within_group >= 0),
  max_score numeric(12, 4) not null default 100
    check (max_score > 0),
  score numeric(12, 4) null,
  min_score numeric(12, 4) null,
  sort_order integer not null default 0,
  assessment_id uuid null references public.assessments (id) on delete set null,
  due_at date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_components_title_length check (char_length(title) between 1 and 120),
  constraint grade_components_score_bounds check (
    score is null or (score >= 0 and score <= max_score)
  ),
  constraint grade_components_min_bounds check (
    min_score is null or (min_score >= 0 and min_score <= max_score)
  ),
  constraint grade_components_group_weight check (
    (group_id is null and weight_within_group is null)
    or (group_id is not null and weight_within_group is not null)
  )
);

create index if not exists grade_components_scheme_idx
  on public.grade_components (scheme_id, sort_order);

create unique index if not exists grade_components_assessment_uidx
  on public.grade_components (scheme_id, assessment_id)
  where assessment_id is not null;

drop trigger if exists grade_components_set_updated_at on public.grade_components;
create trigger grade_components_set_updated_at
before update on public.grade_components
for each row execute function public.set_updated_at();

create or replace function public.enforce_grade_component_ownership()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
  scheme_subject uuid;
begin
  select user_id, subject_id into owner, scheme_subject
  from public.subject_grade_schemes where id = new.scheme_id;
  if owner is null or auth.uid() is distinct from owner then
    raise exception 'Not allowed';
  end if;
  if new.subject_id is distinct from scheme_subject then
    raise exception 'Component subject must match scheme';
  end if;
  new.user_id := owner;

  if new.group_id is not null then
    if not exists (
      select 1 from public.grade_groups g
      where g.id = new.group_id and g.scheme_id = new.scheme_id
    ) then
      raise exception 'Invalid grade group';
    end if;
  end if;

  if new.assessment_id is not null then
    if not exists (
      select 1 from public.assessments a
      where a.id = new.assessment_id
        and a.user_id = owner
        and (a.subject_id is null or a.subject_id = new.subject_id)
    ) then
      raise exception 'Invalid linked assessment';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists grade_components_enforce_ownership on public.grade_components;
create trigger grade_components_enforce_ownership
before insert or update on public.grade_components
for each row execute function public.enforce_grade_component_ownership();

alter table public.grade_components enable row level security;

drop policy if exists "Grade components select own" on public.grade_components;
create policy "Grade components select own"
on public.grade_components for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Grade components insert own" on public.grade_components;
create policy "Grade components insert own"
on public.grade_components for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Grade components update own" on public.grade_components;
create policy "Grade components update own"
on public.grade_components for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Grade components delete own" on public.grade_components;
create policy "Grade components delete own"
on public.grade_components for delete to authenticated
using (auth.uid() = user_id);

revoke all on table public.grade_components from anon;
grant select, insert, update, delete on table public.grade_components to authenticated;
