-- One-day AI Study Planner horizons: today, tomorrow, custom date.
-- Existing longer-term periods remain valid. Applied manually — do not auto-run.

alter table public.planner_preferences
  drop constraint if exists planner_preferences_period_check;

alter table public.planner_preferences
  add constraint planner_preferences_period_check check (
    planning_period in (
      'today',
      'tomorrow',
      'custom',
      '7',
      '14',
      '30',
      'until_exam'
    )
  );

alter table public.planner_preferences
  add column if not exists target_date date;

comment on column public.planner_preferences.target_date is
  'Local calendar date (YYYY-MM-DD) when planning_period = custom.';
