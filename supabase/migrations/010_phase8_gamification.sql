-- Studi Phase 8: Gamification — streaks prefs, achievements, challenges, leaderboards
-- Run AFTER 001–009. Do not edit prior migrations.
--
-- Design notes:
-- - Streaks/goals/leaderboards are computed from verified study_sessions
--   (source in focus|study_together, status=completed, focus_seconds only).
-- - Leaderboard opt-in default OFF. Weekly boundary: Monday 00:00 in user timezone.
-- - Achievements awarded server-side with unique (user_id, achievement_id).
-- - Rest days preserve streaks without incrementing (enforced in app calculation).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'challenge_type') then
    create type public.challenge_type as enum (
      'hours',
      'pomodoros',
      'distinct_days',
      'consistency'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'challenge_visibility') then
    create type public.challenge_visibility as enum ('individual', 'collaborative');
  end if;
  if not exists (select 1 from pg_type where typname = 'challenge_status') then
    create type public.challenge_status as enum (
      'draft',
      'active',
      'completed',
      'expired',
      'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'challenge_participant_status') then
    create type public.challenge_participant_status as enum (
      'invited',
      'active',
      'declined',
      'left',
      'completed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'challenge_invite_status') then
    create type public.challenge_invite_status as enum (
      'pending',
      'accepted',
      'declined',
      'cancelled',
      'expired'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Preferences (optional gamification + leaderboard + streak knobs)
-- weekly_goal_hours remains on study_preferences (single source of truth).
-- ---------------------------------------------------------------------------
create table if not exists public.gamification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  leaderboard_opt_in boolean not null default false,
  achievement_notifications boolean not null default true,
  accept_challenge_invites boolean not null default true,
  timezone text not null default 'UTC',
  min_daily_focus_minutes integer not null default 15
    check (min_daily_focus_minutes >= 1 and min_daily_focus_minutes <= 180),
  rest_days jsonb not null default '[]'::jsonb,
  consistency_days_per_week integer
    check (
      consistency_days_per_week is null
      or (consistency_days_per_week >= 1 and consistency_days_per_week <= 7)
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gamification_preferences_timezone_length check (
    char_length(timezone) between 1 and 64
  )
);

drop trigger if exists gamification_preferences_set_updated_at
  on public.gamification_preferences;
create trigger gamification_preferences_set_updated_at
before update on public.gamification_preferences
for each row execute function public.set_updated_at();

alter table public.gamification_preferences enable row level security;

drop policy if exists "Gamification prefs select own" on public.gamification_preferences;
create policy "Gamification prefs select own" on public.gamification_preferences
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Gamification prefs insert own" on public.gamification_preferences;
create policy "Gamification prefs insert own" on public.gamification_preferences
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Gamification prefs update own" on public.gamification_preferences;
create policy "Gamification prefs update own" on public.gamification_preferences
for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.gamification_preferences from anon;
grant select, insert, update on table public.gamification_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Achievement definitions + user unlocks
-- ---------------------------------------------------------------------------
create table if not exists public.achievement_definitions (
  id text primary key,
  category text not null,
  title text not null,
  description text not null,
  icon text not null default 'spark',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievement_definitions (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index if not exists user_achievements_user_unlocked_idx
  on public.user_achievements (user_id, unlocked_at desc);

alter table public.achievement_definitions enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "Achievement defs read all auth" on public.achievement_definitions;
create policy "Achievement defs read all auth" on public.achievement_definitions
for select to authenticated using (active = true);

drop policy if exists "User achievements select own" on public.user_achievements;
create policy "User achievements select own" on public.user_achievements
for select to authenticated using (auth.uid() = user_id);

-- Inserts only via security definer award function
revoke all on table public.achievement_definitions from anon;
grant select on table public.achievement_definitions to authenticated;
revoke all on table public.user_achievements from anon;
grant select on table public.user_achievements to authenticated;

insert into public.achievement_definitions (id, category, title, description, icon, sort_order)
values
  ('first_focus_session', 'getting_started', 'First Focus', 'Complete your first verified focus session.', 'spark', 10),
  ('first_hour_studied', 'getting_started', 'First Hour', 'Accumulate one hour of verified focus time.', 'hourglass', 20),
  ('first_pomodoro', 'getting_started', 'First Pomodoro', 'Finish a session with at least one Pomodoro cycle.', 'timer', 30),
  ('streak_3', 'consistency', '3-Day Streak', 'Study on three consecutive active days.', 'flame', 40),
  ('streak_7', 'consistency', '7-Day Streak', 'Keep a seven-day study streak.', 'flame', 50),
  ('streak_14', 'consistency', '14-Day Streak', 'Keep a fourteen-day study streak.', 'flame', 60),
  ('streak_30', 'consistency', '30-Day Streak', 'Keep a thirty-day study streak.', 'crown', 70),
  ('hours_5', 'milestones', '5 Hours', 'Reach five hours of verified focus time.', 'book', 80),
  ('hours_10', 'milestones', '10 Hours', 'Reach ten hours of verified focus time.', 'book', 90),
  ('hours_25', 'milestones', '25 Hours', 'Reach twenty-five hours of verified focus time.', 'book', 100),
  ('hours_50', 'milestones', '50 Hours', 'Reach fifty hours of verified focus time.', 'medal', 110),
  ('hours_100', 'milestones', '100 Hours', 'Reach one hundred hours of verified focus time.', 'medal', 120),
  ('first_friend', 'social', 'First Friend', 'Connect with your first study friend.', 'users', 130),
  ('first_study_room', 'social', 'Study Together', 'Create or join your first study room.', 'room', 140),
  ('first_collab_session', 'social', 'Collaborative Focus', 'Save a verified Study Together focus session.', 'room', 150),
  ('first_challenge_completed', 'challenges', 'Challenge Cleared', 'Complete your first study challenge.', 'flag', 160),
  ('five_challenges_completed', 'challenges', 'Challenge Runner', 'Complete five study challenges.', 'flag', 170)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------
create table if not exists public.study_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  challenge_type public.challenge_type not null,
  target_value numeric(10, 2) not null
    check (target_value > 0 and target_value <= 100000),
  visibility public.challenge_visibility not null default 'individual',
  status public.challenge_status not null default 'active',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  show_individual_contributions boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_challenges_name_length check (
    char_length(trim(name)) between 1 and 80
  ),
  constraint study_challenges_description_length check (
    description is null or char_length(description) <= 400
  ),
  constraint study_challenges_window check (ends_at > starts_at)
);

create index if not exists study_challenges_creator_idx
  on public.study_challenges (creator_id, status);
create index if not exists study_challenges_window_idx
  on public.study_challenges (status, starts_at, ends_at);

drop trigger if exists study_challenges_set_updated_at on public.study_challenges;
create trigger study_challenges_set_updated_at
before update on public.study_challenges
for each row execute function public.set_updated_at();

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.study_challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.challenge_participant_status not null default 'active',
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (challenge_id, user_id)
);

create index if not exists challenge_participants_user_idx
  on public.challenge_participants (user_id, status);

create table if not exists public.challenge_invitations (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.study_challenges (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status public.challenge_invite_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint challenge_invitations_not_self check (inviter_id <> invitee_id)
);

create unique index if not exists challenge_invitations_pending_uidx
  on public.challenge_invitations (challenge_id, invitee_id)
  where status = 'pending';
create index if not exists challenge_invitations_invitee_idx
  on public.challenge_invitations (invitee_id, status);

alter table public.study_challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_invitations enable row level security;

create or replace function public.is_challenge_participant(p_challenge_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_participants cp
    where cp.challenge_id = p_challenge_id
      and cp.user_id = p_user_id
      and cp.status in ('active', 'completed')
  );
$$;

revoke all on function public.is_challenge_participant(uuid, uuid) from public;
grant execute on function public.is_challenge_participant(uuid, uuid) to authenticated;

drop policy if exists "Challenges select participants" on public.study_challenges;
create policy "Challenges select participants" on public.study_challenges
for select to authenticated
using (
  creator_id = auth.uid()
  or public.is_challenge_participant(id, auth.uid())
  or exists (
    select 1 from public.challenge_invitations i
    where i.challenge_id = study_challenges.id
      and i.invitee_id = auth.uid()
      and i.status = 'pending'
      and i.expires_at > now()
  )
);

drop policy if exists "Challenges update creator" on public.study_challenges;
create policy "Challenges update creator" on public.study_challenges
for update to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

revoke all on table public.study_challenges from anon;
grant select, update on table public.study_challenges to authenticated;

drop policy if exists "Challenge participants select" on public.challenge_participants;
create policy "Challenge participants select" on public.challenge_participants
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_challenge_participant(challenge_id, auth.uid())
  or exists (
    select 1 from public.study_challenges c
    where c.id = challenge_id and c.creator_id = auth.uid()
  )
);

revoke all on table public.challenge_participants from anon;
grant select on table public.challenge_participants to authenticated;

drop policy if exists "Challenge invites select parties" on public.challenge_invitations;
create policy "Challenge invites select parties" on public.challenge_invitations
for select to authenticated
using (
  invitee_id = auth.uid()
  or inviter_id = auth.uid()
);

drop policy if exists "Challenge invites update parties" on public.challenge_invitations;
create policy "Challenge invites update parties" on public.challenge_invitations
for update to authenticated
using (invitee_id = auth.uid() or inviter_id = auth.uid())
with check (invitee_id = auth.uid() or inviter_id = auth.uid());

revoke all on table public.challenge_invitations from anon;
grant select, update on table public.challenge_invitations to authenticated;

-- ---------------------------------------------------------------------------
-- Award achievement (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.award_achievement(
  p_user_id uuid,
  p_achievement_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not allowed';
  end if;
  if not exists (
    select 1 from public.achievement_definitions d
    where d.id = p_achievement_id and d.active
  ) then
    return false;
  end if;
  insert into public.user_achievements (user_id, achievement_id)
  values (p_user_id, p_achievement_id)
  on conflict (user_id, achievement_id) do nothing;
  return true;
end;
$$;

revoke all on function public.award_achievement(uuid, text) from public;
grant execute on function public.award_achievement(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Friends weekly leaderboard (opt-in only; focus seconds from sessions)
-- Week = [p_week_start, p_week_start + 7 days) in UTC bounds supplied by app
-- after converting Monday 00:00 local → timestamptz.
-- ---------------------------------------------------------------------------
create or replace function public.friends_weekly_leaderboard(
  p_week_start timestamptz,
  p_week_end timestamptz
)
returns table (
  user_id uuid,
  username citext,
  display_name text,
  accent_color public.accent_color,
  avatar_preference public.avatar_preference,
  google_avatar_url text,
  storage_path text,
  can_view_avatar boolean,
  focus_seconds bigint,
  rank bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if p_week_end <= p_week_start then
    raise exception 'Invalid week window';
  end if;

  -- Caller must be opted in to view the board
  if not exists (
    select 1 from public.gamification_preferences gp
    where gp.user_id = me and gp.enabled and gp.leaderboard_opt_in
  ) then
    return;
  end if;

  return query
  with friends as (
    select case when f.user_low = me then f.user_high else f.user_low end as fid
    from public.friendships f
    where f.user_low = me or f.user_high = me
  ),
  eligible as (
    select me as uid
    union
    select fr.fid
    from friends fr
    join public.gamification_preferences gp on gp.user_id = fr.fid
    where gp.enabled
      and gp.leaderboard_opt_in
      and not public.is_blocked_either(me, fr.fid)
  ),
  totals as (
    select e.uid,
      coalesce(sum(ss.focus_seconds), 0)::bigint as focus_seconds
    from eligible e
    left join public.study_sessions ss
      on ss.user_id = e.uid
     and ss.status = 'completed'
     and ss.source in ('focus', 'study_together')
     and ss.starts_at >= p_week_start
     and ss.starts_at < p_week_end
    group by e.uid
  )
  select
    t.uid,
    p.username,
    p.display_name,
    p.accent_color,
    p.avatar_preference,
    case
      when p.avatar_preference = 'google'
        and (
          p.avatar_visibility = 'public'
          or (p.avatar_visibility = 'friends' and (t.uid = me or public.are_friends(me, t.uid)))
        )
      then p.google_avatar_url
      else null
    end,
    case
      when p.avatar_preference = 'custom'
        and p.avatar_path is not null
        and (
          p.avatar_visibility = 'public'
          or (p.avatar_visibility = 'friends' and (t.uid = me or public.are_friends(me, t.uid)))
        )
      then p.avatar_path
      else null
    end,
    (
      p.avatar_visibility = 'public'
      or (p.avatar_visibility = 'friends' and (t.uid = me or public.are_friends(me, t.uid)))
      or t.uid = me
    ),
    t.focus_seconds,
    rank() over (order by t.focus_seconds desc, p.username asc)
  from totals t
  join public.profiles p on p.id = t.uid
  order by focus_seconds desc, p.username asc;
end;
$$;

revoke all on function public.friends_weekly_leaderboard(timestamptz, timestamptz) from public;
grant execute on function public.friends_weekly_leaderboard(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Challenge RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_study_challenge(
  p_name text,
  p_description text,
  p_challenge_type public.challenge_type,
  p_target_value numeric,
  p_visibility public.challenge_visibility,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_show_individual_contributions boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.study_challenges (
    creator_id, name, description, challenge_type, target_value,
    visibility, status, starts_at, ends_at, show_individual_contributions
  ) values (
    me,
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_challenge_type,
    p_target_value,
    p_visibility,
    'active',
    p_starts_at,
    p_ends_at,
    coalesce(p_show_individual_contributions, false)
  )
  returning id into cid;

  insert into public.challenge_participants (challenge_id, user_id, status)
  values (cid, me, 'active');

  return cid;
end;
$$;

revoke all on function public.create_study_challenge(
  text, text, public.challenge_type, numeric, public.challenge_visibility,
  timestamptz, timestamptz, boolean
) from public;
grant execute on function public.create_study_challenge(
  text, text, public.challenge_type, numeric, public.challenge_visibility,
  timestamptz, timestamptz, boolean
) to authenticated;

create or replace function public.invite_to_challenge(
  p_challenge_id uuid,
  p_invitee_id uuid,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  c public.study_challenges%rowtype;
  iid uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into c from public.study_challenges where id = p_challenge_id;
  if c.id is null or c.status <> 'active' then
    raise exception 'Challenge not found';
  end if;
  if c.visibility <> 'collaborative' then
    raise exception 'Individual challenges cannot invite friends';
  end if;
  if c.creator_id <> me and not public.is_challenge_participant(p_challenge_id, me) then
    raise exception 'Not allowed';
  end if;
  if not public.are_friends(me, p_invitee_id) then
    raise exception 'Can only invite friends';
  end if;
  if public.is_blocked_either(me, p_invitee_id) then
    raise exception 'Unable to invite';
  end if;
  if public.is_challenge_participant(p_challenge_id, p_invitee_id) then
    raise exception 'Already participating';
  end if;

  insert into public.challenge_invitations (
    challenge_id, inviter_id, invitee_id, status, expires_at
  ) values (
    p_challenge_id, me, p_invitee_id, 'pending', p_expires_at
  )
  on conflict (challenge_id, invitee_id) where status = 'pending'
  do update set
    inviter_id = excluded.inviter_id,
    expires_at = excluded.expires_at,
    created_at = now(),
    responded_at = null
  returning id into iid;

  return iid;
end;
$$;

revoke all on function public.invite_to_challenge(uuid, uuid, timestamptz) from public;
grant execute on function public.invite_to_challenge(uuid, uuid, timestamptz) to authenticated;

create or replace function public.respond_challenge_invite(
  p_invite_id uuid,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv public.challenge_invitations%rowtype;
  c public.study_challenges%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into inv from public.challenge_invitations where id = p_invite_id for update;
  if inv.id is null or inv.invitee_id <> me then
    raise exception 'Invitation not found';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;
  if inv.expires_at <= now() then
    update public.challenge_invitations
    set status = 'expired', responded_at = now()
    where id = inv.id;
    raise exception 'Invitation expired';
  end if;

  select * into c from public.study_challenges where id = inv.challenge_id for update;
  if c.id is null or c.status <> 'active' then
    raise exception 'Challenge not active';
  end if;
  if public.is_blocked_either(me, c.creator_id) then
    raise exception 'Unable to join';
  end if;

  if p_accept then
    insert into public.challenge_participants (challenge_id, user_id, status)
    values (c.id, me, 'active')
    on conflict (challenge_id, user_id) do update
    set status = 'active', joined_at = now(), completed_at = null;
    update public.challenge_invitations
    set status = 'accepted', responded_at = now()
    where id = inv.id;
  else
    update public.challenge_invitations
    set status = 'declined', responded_at = now()
    where id = inv.id;
  end if;

  return c.id;
end;
$$;

revoke all on function public.respond_challenge_invite(uuid, boolean) from public;
grant execute on function public.respond_challenge_invite(uuid, boolean) to authenticated;

create or replace function public.cancel_challenge(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  update public.study_challenges
  set status = 'cancelled', updated_at = now()
  where id = p_challenge_id and creator_id = me and status = 'active';
  if not found then
    raise exception 'Not allowed';
  end if;
  update public.challenge_invitations
  set status = 'cancelled', responded_at = now()
  where challenge_id = p_challenge_id and status = 'pending';
  return true;
end;
$$;

revoke all on function public.cancel_challenge(uuid) from public;
grant execute on function public.cancel_challenge(uuid) to authenticated;

create or replace function public.mark_challenge_participant_completed(
  p_challenge_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  update public.challenge_participants
  set status = 'completed', completed_at = now()
  where challenge_id = p_challenge_id
    and user_id = me
    and status = 'active';
  return found;
end;
$$;

revoke all on function public.mark_challenge_participant_completed(uuid) from public;
grant execute on function public.mark_challenge_participant_completed(uuid) to authenticated;
