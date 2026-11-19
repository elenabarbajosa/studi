-- OPTIONAL, REVIEWED, OPT-IN DATA FIX. This is not a migration.
-- Do not run it from the Supabase CLI migration path, and do not run it
-- until a person has checked the preview rows below.
--
-- What went wrong
-- ---------------
-- Before the timezone fix, manually entered wall-clock times were parsed in
-- the server's timezone (UTC on Vercel). A student in Europe/Madrid who typed
-- 14:00–15:30 got 14:00Z–15:30Z stored, which displays as 15:00–16:30.
-- Imported .ics events and AI-planned sessions were already stored as real
-- UTC instants and must not be shifted.
--
-- What this script does
-- ---------------------
-- For timed rows only, it reinterprets the stored UTC wall clock as local
-- time in the user's profile timezone (gamification_preferences.timezone)
-- and writes that instant back. Postgres applies the DST offset of that
-- calendar day, so winter and summer are handled separately.
--
-- It does NOT change:
--   * all-day events (all_day = true). Ahead of UTC they already fell on the
--     right calendar day; shifting them would move the day backward.
--   * date-only task dues (noon UTC)
--   * external_calendar_events (Google, Outlook, iCloud, .ics)
--   * focus and study-together sessions (source is not 'calendar')
--   * study sessions linked from study_plan_sessions (the planner already
--     stored a correct instant). If someone later edited one of those in the
--     calendar form, that edit was shifted and this script leaves it alone.
--
-- If a profile timezone is still the default UTC, the update is a no-op for
-- that user. Set the timezone in Settings → progress (or in the preview
-- filter below) to the zone they were actually using, then re-check.
--
-- The transaction ends in ROLLBACK. Change that to COMMIT only after the
-- preview looks right.

begin;

-- Comparisons below assume UTC. Do not change this inside the transaction.
set time zone 'UTC';

-- Preview personal events that would move. Expect the new time to be the
-- wall clock the student originally typed.
select
  e.user_id,
  gp.timezone,
  e.title,
  e.starts_at as stored_start,
  e.ends_at as stored_end,
  ((e.starts_at at time zone 'UTC') at time zone gp.timezone) as corrected_start,
  ((e.ends_at at time zone 'UTC') at time zone gp.timezone) as corrected_end
from public.calendar_events e
join public.gamification_preferences gp on gp.user_id = e.user_id
where e.all_day = false
  and gp.timezone <> 'UTC'
order by e.starts_at
limit 50;

-- Preview timed assessments (exams and deadlines entered by hand).
select
  a.user_id,
  gp.timezone,
  a.title,
  a.starts_at as stored_start,
  ((a.starts_at at time zone 'UTC') at time zone gp.timezone) as corrected_start
from public.assessments a
join public.gamification_preferences gp on gp.user_id = a.user_id
where a.all_day = false
  and gp.timezone <> 'UTC'
order by a.starts_at
limit 50;

-- Preview manual study sessions that are not part of an AI plan.
select
  s.user_id,
  gp.timezone,
  s.starts_at as stored_start,
  ((s.starts_at at time zone 'UTC') at time zone gp.timezone) as corrected_start
from public.study_sessions s
join public.gamification_preferences gp on gp.user_id = s.user_id
where s.source = 'calendar'
  and gp.timezone <> 'UTC'
  and not exists (
    select 1
    from public.study_plan_sessions link
    where link.study_session_id = s.id
  )
order by s.starts_at
limit 50;

-- Uncomment the updates only after the preview is correct.
--
-- update public.calendar_events e
-- set
--   starts_at = ((e.starts_at at time zone 'UTC') at time zone gp.timezone),
--   ends_at = case
--     when e.ends_at is null then null
--     else ((e.ends_at at time zone 'UTC') at time zone gp.timezone)
--   end
-- from public.gamification_preferences gp
-- where gp.user_id = e.user_id
--   and e.all_day = false
--   and gp.timezone <> 'UTC';
--
-- update public.assessments a
-- set
--   starts_at = ((a.starts_at at time zone 'UTC') at time zone gp.timezone),
--   ends_at = case
--     when a.ends_at is null then null
--     else ((a.ends_at at time zone 'UTC') at time zone gp.timezone)
--   end
-- from public.gamification_preferences gp
-- where gp.user_id = a.user_id
--   and a.all_day = false
--   and gp.timezone <> 'UTC';
--
-- update public.study_sessions s
-- set
--   starts_at = ((s.starts_at at time zone 'UTC') at time zone gp.timezone),
--   ends_at = ((s.ends_at at time zone 'UTC') at time zone gp.timezone)
-- from public.gamification_preferences gp
-- where gp.user_id = s.user_id
--   and s.source = 'calendar'
--   and gp.timezone <> 'UTC'
--   and not exists (
--     select 1
--     from public.study_plan_sessions link
--     where link.study_session_id = s.id
--   );
--
-- Timed task dues (not the noon-UTC date-only marker) and scheduled blocks.
-- update public.tasks t
-- set
--   due_at = case
--     when t.due_at is null then null
--     when t.due_at = date_trunc('day', t.due_at at time zone 'UTC') + interval '12 hours'
--       then t.due_at
--     else ((t.due_at at time zone 'UTC') at time zone gp.timezone)
--   end,
--   scheduled_start = case
--     when t.scheduled_start is null then null
--     else ((t.scheduled_start at time zone 'UTC') at time zone gp.timezone)
--   end,
--   scheduled_end = case
--     when t.scheduled_end is null then null
--     else ((t.scheduled_end at time zone 'UTC') at time zone gp.timezone)
--   end
-- from public.gamification_preferences gp
-- where gp.user_id = t.user_id
--   and gp.timezone <> 'UTC';

rollback;
