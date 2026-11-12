-- Studi Phase 6: Friends, social profiles, privacy, presence
-- Run AFTER 001–006. Do not edit prior migrations.
--
-- Profiles table RLS stays owner-only. Discovery and social profile reads go
-- through security-definer RPCs that return only allowed fields.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'social_visibility') then
    create type public.social_visibility as enum ('private', 'friends', 'public');
  end if;
  if not exists (select 1 from pg_type where typname = 'friend_request_status') then
    create type public.friend_request_status as enum (
      'pending',
      'accepted',
      'declined',
      'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'presence_status') then
    create type public.presence_status as enum (
      'offline',
      'online',
      'focusing',
      'on_break'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profile social preferences (non-breaking columns)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists discoverable boolean not null default true,
  add column if not exists online_status_visibility public.social_visibility
    not null default 'friends',
  add column if not exists study_status_visibility public.social_visibility
    not null default 'private',
  add column if not exists stats_visibility public.social_visibility
    not null default 'private';

-- Align avatar_visibility default semantics: keep existing enum; default stays private.
comment on column public.profiles.discoverable is
  'When false, user is excluded from username search RPCs.';
comment on column public.profiles.study_status_visibility is
  'Who may see focusing/on_break presence. Default private.';
comment on column public.profiles.stats_visibility is
  'Who may see aggregate weekly focus hours. Default private. Never exposes tasks/exams.';

-- ---------------------------------------------------------------------------
-- Friendships (accepted = mutual)
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_distinct check (user_low <> user_high),
  constraint friendships_ordered check (user_low < user_high),
  constraint friendships_requester_in_pair check (
    requested_by = user_low or requested_by = user_high
  )
);

create unique index if not exists friendships_pair_uidx
  on public.friendships (user_low, user_high);

create index if not exists friendships_user_low_idx on public.friendships (user_low);
create index if not exists friendships_user_high_idx on public.friendships (user_high);

alter table public.friendships enable row level security;

drop policy if exists "Friendships select participants" on public.friendships;
create policy "Friendships select participants" on public.friendships
for select to authenticated
using (auth.uid() = user_low or auth.uid() = user_high);

-- Inserts/deletes go through security-definer RPCs only
revoke all on table public.friendships from anon;
grant select on table public.friendships to authenticated;

-- ---------------------------------------------------------------------------
-- Friend requests
-- ---------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (requester_id <> recipient_id)
);

-- Only one pending request per ordered direction
create unique index if not exists friend_requests_pending_uidx
  on public.friend_requests (requester_id, recipient_id)
  where status = 'pending';

create index if not exists friend_requests_recipient_pending_idx
  on public.friend_requests (recipient_id, created_at desc)
  where status = 'pending';

create index if not exists friend_requests_requester_pending_idx
  on public.friend_requests (requester_id, created_at desc)
  where status = 'pending';

alter table public.friend_requests enable row level security;

drop policy if exists "Friend requests select parties" on public.friend_requests;
create policy "Friend requests select parties" on public.friend_requests
for select to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Friend requests insert requester" on public.friend_requests;
create policy "Friend requests insert requester" on public.friend_requests
for insert to authenticated
with check (
  auth.uid() = requester_id
  and status = 'pending'
);

drop policy if exists "Friend requests update parties" on public.friend_requests;
create policy "Friend requests update parties" on public.friend_requests
for update to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id)
with check (auth.uid() = requester_id or auth.uid() = recipient_id);

revoke all on table public.friend_requests from anon;
grant select, insert, update on table public.friend_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create unique index if not exists user_blocks_pair_uidx
  on public.user_blocks (blocker_id, blocked_id);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Blocks select blocker" on public.user_blocks;
create policy "Blocks select blocker" on public.user_blocks
for select to authenticated
using (auth.uid() = blocker_id);

drop policy if exists "Blocks insert blocker" on public.user_blocks;
create policy "Blocks insert blocker" on public.user_blocks
for insert to authenticated
with check (auth.uid() = blocker_id);

drop policy if exists "Blocks delete blocker" on public.user_blocks;
create policy "Blocks delete blocker" on public.user_blocks
for delete to authenticated
using (auth.uid() = blocker_id);

revoke all on table public.user_blocks from anon;
grant select, insert, delete on table public.user_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- Helper: friendship / block checks (after tables exist)
-- ---------------------------------------------------------------------------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.user_low = least(a, b)
      and f.user_high = greatest(a, b)
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

create or replace function public.is_blocked_either(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker_id = a and ub.blocked_id = b)
       or (ub.blocker_id = b and ub.blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_either(uuid, uuid) from public;
grant execute on function public.is_blocked_either(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Presence (low-frequency; Focus Mode updates)
-- ---------------------------------------------------------------------------
create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.presence_status not null default 'offline',
  -- Generic label only — never store subject names, goals, or notes here.
  activity_label text,
  updated_at timestamptz not null default now(),
  constraint user_presence_label_length check (
    activity_label is null or char_length(activity_label) <= 40
  )
);

alter table public.user_presence enable row level security;

drop policy if exists "Presence select self" on public.user_presence;
create policy "Presence select self" on public.user_presence
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Presence select friends allowed" on public.user_presence;
create policy "Presence select friends allowed" on public.user_presence
for select to authenticated
using (
  auth.uid() <> user_id
  and public.are_friends(auth.uid(), user_id)
  and not public.is_blocked_either(auth.uid(), user_id)
  and exists (
    select 1 from public.profiles p
    where p.id = user_presence.user_id
      and (
        (
          user_presence.status in ('focusing', 'on_break')
          and p.study_status_visibility in ('friends', 'public')
        )
        or (
          user_presence.status = 'online'
          and p.online_status_visibility in ('friends', 'public')
        )
      )
  )
);

drop policy if exists "Presence select public allowed" on public.user_presence;
create policy "Presence select public allowed" on public.user_presence
for select to authenticated
using (
  auth.uid() <> user_id
  and not public.is_blocked_either(auth.uid(), user_id)
  and exists (
    select 1 from public.profiles p
    where p.id = user_presence.user_id
      and (
        (
          user_presence.status in ('focusing', 'on_break')
          and p.study_status_visibility = 'public'
        )
        or (
          user_presence.status = 'online'
          and p.online_status_visibility = 'public'
        )
      )
  )
);

drop policy if exists "Presence upsert self" on public.user_presence;
create policy "Presence upsert self" on public.user_presence
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Presence update self" on public.user_presence;
create policy "Presence update self" on public.user_presence
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on table public.user_presence from anon;
grant select, insert, update on table public.user_presence to authenticated;

-- Realtime: enable replication for presence (dashboard may also need table added)
alter table public.user_presence replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.user_presence;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing; enable Realtime for user_presence in dashboard.';
  when others then
    raise notice 'Could not add user_presence to realtime publication: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Atomic friend request RPCs
-- ---------------------------------------------------------------------------
create or replace function public.send_friend_request(target_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
  existing_pending uuid;
  reverse_pending uuid;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into target
  from public.profiles
  where username = lower(target_username)::citext;

  if target.id is null then
    raise exception 'User not found';
  end if;

  if target.id = me then
    raise exception 'Cannot friend yourself';
  end if;

  if not target.discoverable then
    raise exception 'User is not discoverable';
  end if;

  if public.is_blocked_either(me, target.id) then
    raise exception 'Unable to send request';
  end if;

  if public.are_friends(me, target.id) then
    raise exception 'Already friends';
  end if;

  select id into existing_pending
  from public.friend_requests
  where requester_id = me
    and recipient_id = target.id
    and status = 'pending';

  if existing_pending is not null then
    return existing_pending;
  end if;

  -- Reciprocal pending → auto-accept into friendship
  select id into reverse_pending
  from public.friend_requests
  where requester_id = target.id
    and recipient_id = me
    and status = 'pending';

  if reverse_pending is not null then
    update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = reverse_pending;

    insert into public.friendships (user_low, user_high, requested_by)
    values (least(me, target.id), greatest(me, target.id), target.id)
    on conflict (user_low, user_high) do nothing;

    return reverse_pending;
  end if;

  insert into public.friend_requests (requester_id, recipient_id, status)
  values (me, target.id, 'pending')
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.send_friend_request(text) from public;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.accept_friend_request(request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  req public.friend_requests%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into req from public.friend_requests where id = request_id for update;
  if req.id is null then
    raise exception 'Request not found';
  end if;
  if req.recipient_id <> me then
    raise exception 'Not allowed';
  end if;
  if req.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;
  if public.is_blocked_either(me, req.requester_id) then
    raise exception 'Unable to accept request';
  end if;

  update public.friend_requests
  set status = 'accepted', responded_at = now()
  where id = request_id;

  insert into public.friendships (user_low, user_high, requested_by)
  values (
    least(req.requester_id, req.recipient_id),
    greatest(req.requester_id, req.recipient_id),
    req.requester_id
  )
  on conflict (user_low, user_high) do nothing;

  -- Cancel any reverse pending request
  update public.friend_requests
  set status = 'cancelled', responded_at = now()
  where requester_id = me
    and recipient_id = req.requester_id
    and status = 'pending';

  return true;
end;
$$;

revoke all on function public.accept_friend_request(uuid) from public;
grant execute on function public.accept_friend_request(uuid) to authenticated;

create or replace function public.remove_friend(friend_user_id uuid)
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

  delete from public.friendships
  where user_low = least(me, friend_user_id)
    and user_high = greatest(me, friend_user_id);

  return true;
end;
$$;

revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;

create or replace function public.block_user(target_user_id uuid)
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
  if target_user_id = me then
    raise exception 'Cannot block yourself';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (me, target_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.friendships
  where user_low = least(me, target_user_id)
    and user_high = greatest(me, target_user_id);

  update public.friend_requests
  set status = 'cancelled', responded_at = now()
  where status = 'pending'
    and (
      (requester_id = me and recipient_id = target_user_id)
      or (requester_id = target_user_id and recipient_id = me)
    );

  return true;
end;
$$;

revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Discovery + social profile RPCs (do not weaken profiles RLS)
-- ---------------------------------------------------------------------------
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

revoke all on function public.search_discoverable_profiles(text, integer, integer) from public;
grant execute on function public.search_discoverable_profiles(text, integer, integer) to authenticated;

create or replace function public.get_social_profile(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  p public.profiles%rowtype;
  friends boolean;
  blocked boolean;
  status text;
  can_see_avatar boolean;
  can_see_stats boolean;
  can_see_study boolean;
  can_see_online boolean;
  weekly_seconds bigint := null;
  presence jsonb := null;
  result jsonb;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into p
  from public.profiles
  where username = lower(target_username)::citext;

  if p.id is null then
    return null;
  end if;

  blocked := public.is_blocked_either(me, p.id);
  if blocked and p.id <> me then
    return null;
  end if;

  friends := public.are_friends(me, p.id) or p.id = me;

  if p.id = me then
    status := 'self';
  elsif friends then
    status := 'friends';
  elsif exists (
    select 1 from public.friend_requests fr
    where fr.status = 'pending' and fr.requester_id = me and fr.recipient_id = p.id
  ) then
    status := 'outgoing';
  elsif exists (
    select 1 from public.friend_requests fr
    where fr.status = 'pending' and fr.requester_id = p.id and fr.recipient_id = me
  ) then
    status := 'incoming';
  else
    status := 'none';
  end if;

  -- Non-friends cannot view non-discoverable profiles (except self)
  if p.id <> me and not p.discoverable and status = 'none' then
    return null;
  end if;

  can_see_avatar :=
    p.id = me
    or p.avatar_visibility = 'public'
    or (p.avatar_visibility = 'friends' and friends);

  can_see_stats :=
    p.id = me
    or p.stats_visibility = 'public'
    or (p.stats_visibility = 'friends' and friends);

  can_see_study :=
    p.id = me
    or p.study_status_visibility = 'public'
    or (p.study_status_visibility = 'friends' and friends);

  can_see_online :=
    p.id = me
    or p.online_status_visibility = 'public'
    or (p.online_status_visibility = 'friends' and friends);

  if can_see_stats then
    select coalesce(sum(ss.focus_seconds), 0) into weekly_seconds
    from public.study_sessions ss
    where ss.user_id = p.id
      and ss.source = 'focus'
      and ss.status = 'completed'
      and ss.starts_at >= date_trunc('week', now());
  end if;

  if can_see_study or can_see_online then
    select jsonb_build_object(
      'status', up.status,
      'activity_label', case when can_see_study then up.activity_label else null end,
      'updated_at', up.updated_at
    )
    into presence
    from public.user_presence up
    where up.user_id = p.id
      and up.updated_at > now() - interval '3 minutes'
      and (
        (up.status in ('focusing', 'on_break') and can_see_study)
        or (up.status = 'online' and can_see_online)
      );
  end if;

  result := jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'bio', p.bio,
    'accent_color', p.accent_color,
    'friendship_status', status,
    'discoverable', p.discoverable,
    'avatar', jsonb_build_object(
      'preference', p.avatar_preference,
      'visibility', p.avatar_visibility,
      'has_custom', (p.avatar_path is not null and p.avatar_preference = 'custom'),
      'google_avatar_url', case
        when can_see_avatar and p.avatar_preference = 'google' then p.google_avatar_url
        else null
      end,
      -- Storage path is never returned. Server mints signed URLs when can_view.
      'can_view', can_see_avatar,
      'storage_path', case
        when can_see_avatar and p.avatar_preference = 'custom' then p.avatar_path
        else null
      end
    ),
    'stats', case
      when can_see_stats then jsonb_build_object(
        'weekly_focus_seconds', coalesce(weekly_seconds, 0)
      )
      else null
    end,
    'presence', presence
  );

  return result;
end;
$$;

revoke all on function public.get_social_profile(text) from public;
grant execute on function public.get_social_profile(text) to authenticated;

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

revoke all on function public.get_social_profile_by_id(uuid) from public;
grant execute on function public.get_social_profile_by_id(uuid) to authenticated;

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
    and not public.is_blocked_either(me, p.id)
  order by p.username;
end;
$$;

revoke all on function public.list_my_friends() from public;
grant execute on function public.list_my_friends() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: allow reading avatars when profile visibility permits
-- (owners already have full access via 005 policies)
-- ---------------------------------------------------------------------------
drop policy if exists "Avatar readable when visibility allows" on storage.objects;
create policy "Avatar readable when visibility allows"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] <> auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    where p.id::text = (storage.foldername(name))[1]
      and p.avatar_preference = 'custom'
      and p.avatar_path = name
      and not public.is_blocked_either(auth.uid(), p.id)
      and (
        p.avatar_visibility = 'public'
        or (
          p.avatar_visibility = 'friends'
          and public.are_friends(auth.uid(), p.id)
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- Realtime authorization for optional Presence topic `friends-presence`
-- Primary live status uses user_presence + postgres_changes (RLS enforced).
-- Requires Realtime → disable "Allow public access" for private channels.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'realtime' and table_name = 'messages'
  ) then
    execute $pol$
      drop policy if exists "Friends presence listen" on realtime.messages;
      create policy "Friends presence listen"
      on realtime.messages
      for select
      to authenticated
      using (
        (select realtime.messages.extension) = 'presence'
        and (select realtime.topic()) = 'friends-presence'
      );

      drop policy if exists "Friends presence track" on realtime.messages;
      create policy "Friends presence track"
      on realtime.messages
      for insert
      to authenticated
      with check (
        (select realtime.messages.extension) = 'presence'
        and (select realtime.topic()) = 'friends-presence'
      );
    $pol$;
  end if;
exception
  when insufficient_privilege then
    raise notice 'Skipping realtime.messages policies (insufficient privilege). Configure in dashboard if needed.';
  when others then
    raise notice 'Skipping realtime.messages policies: %', sqlerrm;
end $$;
