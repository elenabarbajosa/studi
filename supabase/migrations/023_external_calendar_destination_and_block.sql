-- =============================================================================
-- 023 — External calendar destination mapping + independent block-study control
--
-- Adds two independent per-calendar settings (separate from enabled):
--   1. studi_destination — where enabled events appear in Studi Calendar
--      (presentation only; does NOT create native exams/tasks)
--   2. blocks_study — whether busy events from this calendar block the planner
--
-- Existing rows keep their `enabled` value.
-- Existing enabled calendars default to destination=external and blocks_study=true
-- so prior planner availability behavior is preserved.
-- Disabled calendars stay disabled.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'external_calendar_destination'
  ) then
    create type public.external_calendar_destination as enum (
      'exams',
      'deadlines',
      'tasks',
      'personal',
      'external'
    );
  end if;
end $$;

alter table public.external_calendars
  add column if not exists studi_destination public.external_calendar_destination
    not null default 'external';

alter table public.external_calendars
  add column if not exists blocks_study boolean not null default true;

comment on column public.external_calendars.studi_destination is
  'Presentation category in Studi Calendar. Does not create native assessments/tasks.';

comment on column public.external_calendars.blocks_study is
  'When true (and calendar enabled), busy provider events block Study Planner availability.';

create index if not exists external_calendars_user_block_idx
  on public.external_calendars (user_id, enabled, blocks_study)
  where enabled = true and blocks_study = true;
