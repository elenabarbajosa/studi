-- =============================================================================
-- 024 — New-account privacy defaults
--
-- Changes DEFAULT values and the signup trigger for NEW accounts only.
-- Does NOT UPDATE existing profiles or gamification_preferences rows.
-- =============================================================================

-- Column defaults (affect inserts that omit these columns).
alter table public.profiles
  alter column avatar_visibility set default 'public'::public.avatar_visibility;

alter table public.profiles
  alter column online_status_visibility set default 'friends'::public.social_visibility;

alter table public.profiles
  alter column study_status_visibility set default 'friends'::public.social_visibility;

alter table public.profiles
  alter column stats_visibility set default 'friends'::public.social_visibility;

alter table public.profiles
  alter column discoverable set default true;

alter table public.gamification_preferences
  alter column leaderboard_opt_in set default true;

comment on column public.profiles.avatar_visibility is
  'Who may see the avatar. New accounts default to public; Storage access still uses can_read_avatar_object.';
comment on column public.profiles.study_status_visibility is
  'Who may see focusing/on_break presence. New accounts default to friends (accepted friendships only).';
comment on column public.profiles.stats_visibility is
  'Who may see aggregate weekly focus hours. New accounts default to friends. Never exposes tasks/exams.';
comment on column public.gamification_preferences.leaderboard_opt_in is
  'Friends weekly leaderboard participation. New accounts default to opted in; existing rows unchanged.';

-- Signup path: explicit privacy + seed gamification prefs for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
  google_picture text;
  preference public.avatar_preference := 'initials';
begin
  base_username := lower(
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      split_part(new.email, '@', 1),
      'student'
    )
  );
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '_', 'g');
  base_username := substr(base_username, 1, 20);
  if char_length(base_username) < 3 then
    base_username := 'student';
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '_' || suffix::text;
  end loop;

  google_picture := nullif(
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    ''
  );

  if google_picture is not null then
    preference := 'google';
  end if;

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    google_avatar_url,
    avatar_preference,
    avatar_visibility,
    discoverable,
    online_status_visibility,
    study_status_visibility,
    stats_visibility
  )
  values (
    new.id,
    candidate,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      initcap(replace(candidate, '_', ' '))
    ),
    null,
    google_picture,
    preference,
    'public',
    true,
    'friends',
    'friends',
    'friends'
  );

  insert into public.gamification_preferences (
    user_id,
    enabled,
    leaderboard_opt_in,
    achievement_notifications,
    accept_challenge_invites
  )
  values (
    new.id,
    true,
    true,
    true,
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
