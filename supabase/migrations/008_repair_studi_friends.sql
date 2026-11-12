-- Studi 008: restore missing Phase 6 RPCs only.
-- Run in Supabase SQL Editor after applying the earlier partial 007.
-- Does NOT modify rows or tables. One transaction: failure rolls back all changes.
BEGIN;

-- The completed search RPC has additional OUT columns. PostgreSQL cannot
-- CREATE OR REPLACE a function with a changed return shape, so drop only
-- this specific RPC signature (without CASCADE) and recreate it atomically.
DROP FUNCTION IF EXISTS public.search_discoverable_profiles(text, integer, integer);

create or replace function public.search_discoverable_profiles(
  query text,
  result_limit integer default 20,
  result_offset integer default 0
)
returns table (
  id uuid,
  username citext,
  display_name text,
  accent_color public.accent_color,
  avatar_preference public.avatar_preference,
  avatar_visibility public.avatar_visibility,
  google_avatar_url text,
  has_custom_avatar boolean,
  storage_path text,
  friendship_status text,
  request_id uuid,
  bio text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  q text := lower(trim(coalesce(query, '')));
  lim integer := least(greatest(coalesce(result_limit, 20), 1), 50);
  off integer := greatest(coalesce(result_offset, 0), 0);
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(q) < 1 then
    return;
  end if;
  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.accent_color,
    p.avatar_preference,
    p.avatar_visibility,
    case
      when p.avatar_preference = 'google'
        and (
          p.avatar_visibility = 'public'
          or (p.avatar_visibility = 'friends' and public.are_friends(me, p.id))
        )
      then p.google_avatar_url
      else null
    end as google_avatar_url,
    (p.avatar_path is not null and p.avatar_preference = 'custom') as has_custom_avatar,
    case
      when p.avatar_preference = 'custom'
        and p.avatar_path is not null
        and (
          p.avatar_visibility = 'public'
          or (p.avatar_visibility = 'friends' and public.are_friends(me, p.id))
        )
      then p.avatar_path
      else null
    end as storage_path,
    case
      when public.are_friends(me, p.id) then 'friends'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.requester_id = me and fr.recipient_id = p.id
      ) then 'outgoing'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.requester_id = p.id and fr.recipient_id = me
      ) then 'incoming'
      else 'none'
    end as friendship_status,
    (
      select fr.id
      from public.friend_requests fr
      where fr.status = 'pending'
        and (
          (fr.requester_id = me and fr.recipient_id = p.id)
          or (fr.requester_id = p.id and fr.recipient_id = me)
        )
      order by fr.created_at desc
      limit 1
    ) as request_id,
    left(coalesce(p.bio, ''), 160) as bio
  from public.profiles p
  where p.id <> me
    and p.discoverable = true
    and not public.is_blocked_either(me, p.id)
    and (
      p.username::text like q || '%'
      or p.username::text like '%' || q || '%'
    )
  order by
    case when p.username::text = q then 0
         when p.username::text like q || '%' then 1
         else 2 end,
    p.username
  limit lim
  offset off;
end;
$$;
REVOKE ALL ON FUNCTION public.search_discoverable_profiles(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_discoverable_profiles(text, integer, integer) TO authenticated;

create or replace function public.get_social_profile_by_id(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname citext;
begin
  select username into uname from public.profiles where id = target_id;
  if uname is null then
    return null;
  end if;
  return public.get_social_profile(uname::text);
end;
$$;
REVOKE ALL ON FUNCTION public.get_social_profile_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_social_profile_by_id(uuid) TO authenticated;

create or replace function public.list_my_friends()
returns table (
  id uuid,
  username citext,
  display_name text,
  accent_color public.accent_color,
  avatar_preference public.avatar_preference,
  avatar_visibility public.avatar_visibility,
  google_avatar_url text,
  has_custom_avatar boolean,
  storage_path text,
  can_view_avatar boolean,
  presence_status public.presence_status,
  presence_label text,
  presence_updated_at timestamptz,
  weekly_focus_seconds bigint
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
  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.accent_color,
    p.avatar_preference,
    p.avatar_visibility,
    case
      when (
        p.avatar_visibility = 'public'
        or p.avatar_visibility = 'friends'
      ) and p.avatar_preference = 'google'
      then p.google_avatar_url
      else null
    end,
    (p.avatar_path is not null and p.avatar_preference = 'custom'),
    case
      when (
        p.avatar_visibility = 'public'
        or p.avatar_visibility = 'friends'
      ) and p.avatar_preference = 'custom'
      then p.avatar_path
      else null
    end,
    (p.avatar_visibility in ('public', 'friends')),
    case
      when up.updated_at > now() - interval '3 minutes'
        and (
          (up.status in ('focusing', 'on_break') and p.study_status_visibility in ('friends', 'public'))
          or (up.status = 'online' and p.online_status_visibility in ('friends', 'public'))
        )
      then up.status
      else 'offline'::public.presence_status
    end,
    case
      when up.updated_at > now() - interval '3 minutes'
        and up.status in ('focusing', 'on_break')
        and p.study_status_visibility in ('friends', 'public')
      then up.activity_label
      else null
    end,
    up.updated_at,
    case
      when p.stats_visibility in ('friends', 'public') then (
        select coalesce(sum(ss.focus_seconds), 0)
        from public.study_sessions ss
        where ss.user_id = p.id
          and ss.source = 'focus'
          and ss.status = 'completed'
          and ss.starts_at >= date_trunc('week', now())
      )
      else null
    end
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_low = me then f.user_high else f.user_low end
  left join public.user_presence up on up.user_id = p.id
  where (f.user_low = me or f.user_high = me)
