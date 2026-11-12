-- Studi Phase 7: Study Together rooms, sync timer, invites, chat
-- Run AFTER 001–008. Do not edit prior migrations.
--
-- Design notes:
-- - Persistent membership in study_room_members; live connection via Realtime Presence.
-- - Shared Pomodoro state is server-authoritative in study_room_timer_state.
-- - Phase advances via reconcile_room_timer() on read/mutate (idempotent).
--   Unattended rooms do NOT auto-advance without an authorized client or future cron.
-- - Personal focus time is saved to study_sessions (source = study_together) with
--   client_session_id idempotency; never inferred from host timer alone.
-- - Invite links use SHA-256 token hashes; raw tokens returned only at creation.
-- - Host transfer: intentional leave/end transfers to longest-standing active member.
--   Presence disconnect does not remove membership or host role.

-- ---------------------------------------------------------------------------
-- Enums (add study_together to existing source enum separately if needed)
-- ---------------------------------------------------------------------------
alter type public.study_session_source add value if not exists 'study_together';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'study_room_visibility') then
    create type public.study_room_visibility as enum ('private', 'friends');
  end if;
  if not exists (select 1 from pg_type where typname = 'study_room_status') then
    create type public.study_room_status as enum ('active', 'ended');
  end if;
  if not exists (select 1 from pg_type where typname = 'study_room_phase') then
    create type public.study_room_phase as enum (
      'idle',
      'focus',
      'short_break',
      'long_break'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'study_room_run_state') then
    create type public.study_room_run_state as enum ('idle', 'running', 'paused');
  end if;
  if not exists (select 1 from pg_type where typname = 'study_room_member_role') then
    create type public.study_room_member_role as enum ('host', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'study_room_member_status') then
    create type public.study_room_member_status as enum ('active', 'left');
  end if;
  if not exists (select 1 from pg_type where typname = 'study_room_invite_status') then
    create type public.study_room_invite_status as enum (
      'pending',
      'accepted',
      'declined',
      'cancelled',
      'expired'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  host_id uuid not null references public.profiles (id) on delete cascade,
  visibility public.study_room_visibility not null default 'private',
  max_participants integer not null default 8
    check (max_participants >= 2 and max_participants <= 16),
  focus_minutes integer not null default 25
    check (focus_minutes >= 5 and focus_minutes <= 120),
  short_break_minutes integer not null default 5
    check (short_break_minutes >= 1 and short_break_minutes <= 30),
  long_break_minutes integer not null default 15
    check (long_break_minutes >= 5 and long_break_minutes <= 60),
  intervals_before_long integer not null default 4
    check (intervals_before_long >= 2 and intervals_before_long <= 8),
  chat_enabled boolean not null default true,
  members_can_invite boolean not null default false,
  status public.study_room_status not null default 'active',
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_rooms_name_length check (
    char_length(trim(name)) between 1 and 80
  ),
  constraint study_rooms_description_length check (
    description is null or char_length(description) <= 280
  )
);

create index if not exists study_rooms_host_status_idx
  on public.study_rooms (host_id, status);
create index if not exists study_rooms_status_expires_idx
  on public.study_rooms (status, expires_at);

drop trigger if exists study_rooms_set_updated_at on public.study_rooms;
create trigger study_rooms_set_updated_at
before update on public.study_rooms
for each row execute function public.set_updated_at();

alter table public.study_rooms enable row level security;

-- ---------------------------------------------------------------------------
-- Members (persistent)
-- ---------------------------------------------------------------------------
create table if not exists public.study_room_members (
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.study_room_member_role not null default 'member',
  status public.study_room_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id)
);

create index if not exists study_room_members_user_active_idx
  on public.study_room_members (user_id, status);
create index if not exists study_room_members_room_active_idx
  on public.study_room_members (room_id, status);

alter table public.study_room_members enable row level security;

-- ---------------------------------------------------------------------------
-- Invitations (token hash only)
-- ---------------------------------------------------------------------------
create table if not exists public.study_room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null,
  status public.study_room_invite_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint study_room_invitations_not_self check (inviter_id <> invitee_id),
  constraint study_room_invitations_token_hash_length check (
    char_length(token_hash) = 64
  )
);

create unique index if not exists study_room_invitations_token_hash_uidx
  on public.study_room_invitations (token_hash);
create unique index if not exists study_room_invitations_pending_uidx
  on public.study_room_invitations (room_id, invitee_id)
  where status = 'pending';
create index if not exists study_room_invitations_invitee_pending_idx
  on public.study_room_invitations (invitee_id, status, expires_at);

alter table public.study_room_invitations enable row level security;

-- ---------------------------------------------------------------------------
-- Authoritative shared timer (1:1 with room)
-- ---------------------------------------------------------------------------
create table if not exists public.study_room_timer_state (
  room_id uuid primary key references public.study_rooms (id) on delete cascade,
  phase public.study_room_phase not null default 'idle',
  run_state public.study_room_run_state not null default 'idle',
  phase_duration_ms integer not null default 0
    check (phase_duration_ms >= 0 and phase_duration_ms <= 7200000),
  phase_started_at timestamptz,
  phase_ends_at timestamptz,
  remaining_ms_when_paused integer
    check (
      remaining_ms_when_paused is null
      or (remaining_ms_when_paused >= 0 and remaining_ms_when_paused <= 7200000)
    ),
  cycle_number integer not null default 0
    check (cycle_number >= 0 and cycle_number <= 500),
  completed_focus_intervals integer not null default 0
    check (completed_focus_intervals >= 0 and completed_focus_intervals <= 500),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.study_room_timer_state enable row level security;
alter table public.study_room_timer_state replica identity full;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table if not exists public.study_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  client_message_id uuid not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint study_room_messages_body_length check (
    char_length(trim(body)) between 1 and 500
  )
);

create unique index if not exists study_room_messages_idempotent_uidx
  on public.study_room_messages (room_id, sender_id, client_message_id);
create index if not exists study_room_messages_room_created_idx
  on public.study_room_messages (room_id, created_at desc);

alter table public.study_room_messages enable row level security;
alter table public.study_room_messages replica identity full;

-- Retention: messages older than 7 days may be purged (manual/cron). Soft-delete
-- via deleted_at hides body immediately for clients.

-- ---------------------------------------------------------------------------
-- Link study_sessions to rooms (personal tracking)
-- ---------------------------------------------------------------------------
alter table public.study_sessions
  add column if not exists room_id uuid references public.study_rooms (id)
    on delete set null;

create index if not exists study_sessions_user_room_idx
  on public.study_sessions (user_id, room_id)
  where room_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_active_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_room_members m
    join public.study_rooms r on r.id = m.room_id
    where m.room_id = p_room_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and r.status = 'active'
  );
$$;

revoke all on function public.is_active_room_member(uuid, uuid) from public;
grant execute on function public.is_active_room_member(uuid, uuid) to authenticated;

create or replace function public.can_invite_to_room(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_rooms r
    join public.study_room_members m
      on m.room_id = r.id and m.user_id = p_user_id and m.status = 'active'
    where r.id = p_room_id
      and r.status = 'active'
      and (r.host_id = p_user_id or r.members_can_invite = true)
  );
$$;

revoke all on function public.can_invite_to_room(uuid, uuid) from public;
grant execute on function public.can_invite_to_room(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
drop policy if exists "Study rooms select members" on public.study_rooms;
create policy "Study rooms select members" on public.study_rooms
for select to authenticated
using (
  public.is_active_room_member(id, auth.uid())
  or (
    status = 'active'
    and visibility = 'friends'
    and public.are_friends(host_id, auth.uid())
    and not public.is_blocked_either(host_id, auth.uid())
  )
  or exists (
    select 1 from public.study_room_invitations i
    where i.room_id = study_rooms.id
      and i.invitee_id = auth.uid()
      and i.status = 'pending'
      and i.expires_at > now()
  )
);

drop policy if exists "Study rooms update host" on public.study_rooms;
create policy "Study rooms update host" on public.study_rooms
for update to authenticated
using (host_id = auth.uid() and status = 'active')
with check (host_id = auth.uid());

-- Inserts via security-definer RPC only
revoke all on table public.study_rooms from anon;
grant select, update on table public.study_rooms to authenticated;

drop policy if exists "Study room members select" on public.study_room_members;
create policy "Study room members select" on public.study_room_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_active_room_member(room_id, auth.uid())
);

revoke all on table public.study_room_members from anon;
grant select on table public.study_room_members to authenticated;

drop policy if exists "Study room invites select parties" on public.study_room_invitations;
create policy "Study room invites select parties" on public.study_room_invitations
for select to authenticated
using (
  invitee_id = auth.uid()
  or inviter_id = auth.uid()
  or public.is_active_room_member(room_id, auth.uid())
);

drop policy if exists "Study room invites update parties" on public.study_room_invitations;
create policy "Study room invites update parties" on public.study_room_invitations
for update to authenticated
using (
  invitee_id = auth.uid()
  or inviter_id = auth.uid()
  or public.can_invite_to_room(room_id, auth.uid())
)
with check (
  invitee_id = auth.uid()
  or inviter_id = auth.uid()
  or public.can_invite_to_room(room_id, auth.uid())
);

revoke all on table public.study_room_invitations from anon;
grant select, update on table public.study_room_invitations to authenticated;

drop policy if exists "Study room timer select members" on public.study_room_timer_state;
create policy "Study room timer select members" on public.study_room_timer_state
for select to authenticated
using (public.is_active_room_member(room_id, auth.uid()));

revoke all on table public.study_room_timer_state from anon;
grant select on table public.study_room_timer_state to authenticated;

drop policy if exists "Study room messages select members" on public.study_room_messages;
create policy "Study room messages select members" on public.study_room_messages
for select to authenticated
using (public.is_active_room_member(room_id, auth.uid()));

drop policy if exists "Study room messages insert members" on public.study_room_messages;
create policy "Study room messages insert members" on public.study_room_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_active_room_member(room_id, auth.uid())
  and exists (
    select 1 from public.study_rooms r
    where r.id = room_id and r.chat_enabled = true and r.status = 'active'
  )
);

drop policy if exists "Study room messages soft delete own" on public.study_room_messages;
create policy "Study room messages soft delete own" on public.study_room_messages
for update to authenticated
using (
  sender_id = auth.uid()
  and public.is_active_room_member(room_id, auth.uid())
)
with check (sender_id = auth.uid());

revoke all on table public.study_room_messages from anon;
grant select, insert, update on table public.study_room_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.study_room_timer_state;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Enable Realtime for study_room_timer_state in dashboard.';
  when others then
    raise notice 'Realtime publication timer: %', sqlerrm;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.study_room_messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Enable Realtime for study_room_messages in dashboard.';
  when others then
    raise notice 'Realtime publication messages: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- create_study_room
-- ---------------------------------------------------------------------------
create or replace function public.create_study_room(
  p_name text,
  p_description text default null,
  p_visibility public.study_room_visibility default 'private',
  p_max_participants integer default 8,
  p_focus_minutes integer default 25,
  p_short_break_minutes integer default 5,
  p_long_break_minutes integer default 15,
  p_intervals_before_long integer default 4,
  p_chat_enabled boolean default true,
  p_members_can_invite boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  rid uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.study_rooms (
    name, description, host_id, visibility, max_participants,
    focus_minutes, short_break_minutes, long_break_minutes,
    intervals_before_long, chat_enabled, members_can_invite
  ) values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    me,
    p_visibility,
    p_max_participants,
    p_focus_minutes,
    p_short_break_minutes,
    p_long_break_minutes,
    p_intervals_before_long,
    p_chat_enabled,
    p_members_can_invite
  )
  returning id into rid;

  insert into public.study_room_members (room_id, user_id, role, status)
  values (rid, me, 'host', 'active');

  insert into public.study_room_timer_state (room_id, phase, run_state, revision)
  values (rid, 'idle', 'idle', 1);

  return rid;
end;
$$;

revoke all on function public.create_study_room(
  text, text, public.study_room_visibility, integer, integer, integer, integer, integer, boolean, boolean
) from public;
grant execute on function public.create_study_room(
  text, text, public.study_room_visibility, integer, integer, integer, integer, integer, boolean, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- create_study_room_invite (stores hash; raw token never persisted)
-- ---------------------------------------------------------------------------
create or replace function public.create_study_room_invite(
  p_room_id uuid,
  p_invitee_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
  invite_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_invite_to_room(p_room_id, me) then
    raise exception 'Not allowed to invite';
  end if;
  if p_invitee_id = me then
    raise exception 'Cannot invite yourself';
  end if;
  if char_length(p_token_hash) <> 64 then
    raise exception 'Invalid token hash';
  end if;
  if p_expires_at <= now() then
    raise exception 'Expiry must be in the future';
  end if;

  select * into r from public.study_rooms where id = p_room_id;
  if r.id is null or r.status <> 'active' then
    raise exception 'Room not found';
  end if;
  if not public.are_friends(me, p_invitee_id) then
    raise exception 'Can only invite friends';
  end if;
  if public.is_blocked_either(me, p_invitee_id) then
    raise exception 'Unable to invite';
  end if;
  if public.is_active_room_member(p_room_id, p_invitee_id) then
    raise exception 'Already a member';
  end if;

  insert into public.study_room_invitations (
    room_id, inviter_id, invitee_id, token_hash, status, expires_at
  ) values (
    p_room_id, me, p_invitee_id, lower(p_token_hash), 'pending', p_expires_at
  )
  on conflict (room_id, invitee_id) where status = 'pending'
  do update set
    token_hash = excluded.token_hash,
    expires_at = excluded.expires_at,
    inviter_id = excluded.inviter_id,
    created_at = now(),
    responded_at = null
  returning id into invite_id;

  return invite_id;
end;
$$;

revoke all on function public.create_study_room_invite(uuid, uuid, text, timestamptz) from public;
grant execute on function public.create_study_room_invite(uuid, uuid, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- accept invite by token hash
-- ---------------------------------------------------------------------------
create or replace function public.accept_study_room_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv public.study_room_invitations%rowtype;
  r public.study_rooms%rowtype;
  member_count integer;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv
  from public.study_room_invitations
  where token_hash = lower(p_token_hash)
  for update;

  if inv.id is null then
    raise exception 'Invitation not found';
  end if;
  if inv.invitee_id <> me then
    raise exception 'Not your invitation';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Invitation is no longer valid';
  end if;
  if inv.expires_at <= now() then
    update public.study_room_invitations
    set status = 'expired', responded_at = now()
    where id = inv.id;
    raise exception 'Invitation expired';
  end if;

  select * into r from public.study_rooms where id = inv.room_id for update;
  if r.id is null or r.status <> 'active' then
    raise exception 'Room is not active';
  end if;
  if public.is_blocked_either(me, r.host_id) then
    raise exception 'Unable to join';
  end if;
  if r.visibility = 'friends' and not public.are_friends(me, r.host_id) then
    raise exception 'Friendship required';
  end if;

  select count(*) into member_count
  from public.study_room_members
  where room_id = r.id and status = 'active';
  if member_count >= r.max_participants then
    raise exception 'Room is full';
  end if;

  insert into public.study_room_members (room_id, user_id, role, status)
  values (r.id, me, 'member', 'active')
  on conflict (room_id, user_id) do update
  set status = 'active', left_at = null, joined_at = now(), role = 'member';

  update public.study_room_invitations
  set status = 'accepted', responded_at = now()
  where id = inv.id;

  return r.id;
end;
$$;

revoke all on function public.accept_study_room_invite(text) from public;
grant execute on function public.accept_study_room_invite(text) to authenticated;

create or replace function public.respond_study_room_invite(
  p_invite_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv public.study_room_invitations%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv
  from public.study_room_invitations
  where id = p_invite_id
  for update;

  if inv.id is null or inv.invitee_id <> me then
    raise exception 'Invitation not found';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;
  if inv.expires_at <= now() then
    update public.study_room_invitations
    set status = 'expired', responded_at = now()
    where id = inv.id;
    raise exception 'Invitation expired';
  end if;

  if p_accept then
    perform public.accept_study_room_invite(inv.token_hash);
  else
    update public.study_room_invitations
    set status = 'declined', responded_at = now()
    where id = inv.id;
  end if;
  return true;
end;
$$;

revoke all on function public.respond_study_room_invite(uuid, boolean) from public;
grant execute on function public.respond_study_room_invite(uuid, boolean) to authenticated;

create or replace function public.cancel_study_room_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv public.study_room_invitations%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into inv from public.study_room_invitations where id = p_invite_id for update;
  if inv.id is null then
    raise exception 'Invitation not found';
  end if;
  if inv.inviter_id <> me and not public.can_invite_to_room(inv.room_id, me) then
    raise exception 'Not allowed';
  end if;
  if inv.status <> 'pending' then
    return true;
  end if;
  update public.study_room_invitations
  set status = 'cancelled', responded_at = now()
  where id = inv.id;
  return true;
end;
$$;

revoke all on function public.cancel_study_room_invite(uuid) from public;
grant execute on function public.cancel_study_room_invite(uuid) to authenticated;

-- Join friends-only room without invite (still requires friendship)
create or replace function public.join_friends_study_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
  member_count integer;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into r from public.study_rooms where id = p_room_id for update;
  if r.id is null or r.status <> 'active' then
    raise exception 'Room not found';
  end if;
  if r.visibility <> 'friends' then
    raise exception 'Private rooms require an invitation';
  end if;
  if not public.are_friends(me, r.host_id) then
    raise exception 'Friendship required';
  end if;
  if public.is_blocked_either(me, r.host_id) then
    raise exception 'Unable to join';
  end if;
  if public.is_active_room_member(p_room_id, me) then
    return true;
  end if;
  select count(*) into member_count
  from public.study_room_members
  where room_id = p_room_id and status = 'active';
  if member_count >= r.max_participants then
    raise exception 'Room is full';
  end if;
  insert into public.study_room_members (room_id, user_id, role, status)
  values (p_room_id, me, 'member', 'active')
  on conflict (room_id, user_id) do update
  set status = 'active', left_at = null, joined_at = now();
  return true;
end;
$$;

revoke all on function public.join_friends_study_room(uuid) from public;
grant execute on function public.join_friends_study_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- leave / kick / transfer / end
-- ---------------------------------------------------------------------------
create or replace function public.transfer_study_room_host(
  p_room_id uuid,
  p_new_host_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
  next_host uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into r from public.study_rooms where id = p_room_id for update;
  if r.id is null or r.status <> 'active' then
    raise exception 'Room not found';
  end if;
  if r.host_id <> me then
    raise exception 'Only the host can transfer';
  end if;

  if p_new_host_id is not null then
    if not public.is_active_room_member(p_room_id, p_new_host_id) then
      raise exception 'New host must be an active member';
    end if;
    next_host := p_new_host_id;
  else
    select m.user_id into next_host
    from public.study_room_members m
    where m.room_id = p_room_id
      and m.status = 'active'
      and m.user_id <> me
    order by m.joined_at asc
    limit 1;
  end if;

  if next_host is null then
    return null;
  end if;

  update public.study_room_members
  set role = 'member'
  where room_id = p_room_id and user_id = me;

  update public.study_room_members
  set role = 'host'
  where room_id = p_room_id and user_id = next_host;

  update public.study_rooms
  set host_id = next_host, updated_at = now()
  where id = p_room_id;

  return next_host;
end;
$$;

revoke all on function public.transfer_study_room_host(uuid, uuid) from public;
grant execute on function public.transfer_study_room_host(uuid, uuid) to authenticated;

create or replace function public.leave_study_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
  remaining integer;
  new_host uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into r from public.study_rooms where id = p_room_id for update;
  if r.id is null then
    raise exception 'Room not found';
  end if;

  if r.host_id = me and r.status = 'active' then
    new_host := public.transfer_study_room_host(p_room_id, null);
    if new_host is null then
      -- Host was alone → end room
      update public.study_rooms
      set status = 'ended', ended_at = now(), updated_at = now()
      where id = p_room_id;
      update public.study_room_timer_state
      set phase = 'idle', run_state = 'idle',
          phase_started_at = null, phase_ends_at = null,
          remaining_ms_when_paused = null,
          revision = revision + 1, updated_at = now(), updated_by = me
      where room_id = p_room_id;
    end if;
  end if;

  update public.study_room_members
  set status = 'left', left_at = now(), role = 'member'
  where room_id = p_room_id and user_id = me and status = 'active';

  select count(*) into remaining
  from public.study_room_members
  where room_id = p_room_id and status = 'active';

  if remaining = 0 and r.status = 'active' then
    update public.study_rooms
    set status = 'ended', ended_at = now(), updated_at = now()
    where id = p_room_id;
  end if;

  return true;
end;
$$;

revoke all on function public.leave_study_room(uuid) from public;
grant execute on function public.leave_study_room(uuid) to authenticated;

create or replace function public.kick_study_room_member(
  p_room_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into r from public.study_rooms where id = p_room_id for update;
  if r.id is null or r.status <> 'active' then
    raise exception 'Room not found';
  end if;
  if r.host_id <> me then
    raise exception 'Only the host can remove participants';
  end if;
  if p_user_id = me then
    raise exception 'Host cannot kick themselves';
  end if;
  update public.study_room_members
  set status = 'left', left_at = now()
  where room_id = p_room_id and user_id = p_user_id and status = 'active';
  return true;
end;
$$;

revoke all on function public.kick_study_room_member(uuid, uuid) from public;
grant execute on function public.kick_study_room_member(uuid, uuid) to authenticated;

create or replace function public.end_study_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into r from public.study_rooms where id = p_room_id for update;
  if r.id is null then
    raise exception 'Room not found';
  end if;
  if r.host_id <> me then
    raise exception 'Only the host can end the room';
  end if;
  update public.study_rooms
  set status = 'ended', ended_at = now(), updated_at = now()
  where id = p_room_id;
  update public.study_room_timer_state
  set phase = 'idle', run_state = 'idle',
      phase_started_at = null, phase_ends_at = null,
      remaining_ms_when_paused = null,
      revision = revision + 1, updated_at = now(), updated_by = me
  where room_id = p_room_id;
  update public.study_room_members
  set status = 'left', left_at = coalesce(left_at, now())
  where room_id = p_room_id and status = 'active';
  return true;
end;
$$;

revoke all on function public.end_study_room(uuid) from public;
grant execute on function public.end_study_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Timer: reconcile expired phases (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_room_timer(p_room_id uuid)
returns public.study_room_timer_state
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
  t public.study_room_timer_state%rowtype;
  next_phase public.study_room_phase;
  next_duration integer;
  next_cycle integer;
  next_completed integer;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_active_room_member(p_room_id, me) then
    raise exception 'Not a room member';
  end if;

  select * into r from public.study_rooms where id = p_room_id;
  if r.id is null or r.status <> 'active' then
    raise exception 'Room not active';
  end if;

  select * into t
  from public.study_room_timer_state
  where room_id = p_room_id
  for update;

  -- Advance at most once per call when phase has expired while running
  if t.run_state = 'running'
     and t.phase_ends_at is not null
     and t.phase_ends_at <= now()
     and t.phase in ('focus', 'short_break', 'long_break')
  then
    next_completed := t.completed_focus_intervals;
    next_cycle := t.cycle_number;

    if t.phase = 'focus' then
      next_completed := t.completed_focus_intervals + 1;
      next_cycle := t.cycle_number + 1;
      if next_completed % r.intervals_before_long = 0 then
        next_phase := 'long_break';
        next_duration := r.long_break_minutes * 60000;
      else
        next_phase := 'short_break';
        next_duration := r.short_break_minutes * 60000;
      end if;
    else
      next_phase := 'focus';
      next_duration := r.focus_minutes * 60000;
    end if;

    update public.study_room_timer_state
    set
      phase = next_phase,
      run_state = 'running',
      phase_duration_ms = next_duration,
      phase_started_at = now(),
      phase_ends_at = now() + (next_duration || ' milliseconds')::interval,
      remaining_ms_when_paused = null,
      completed_focus_intervals = next_completed,
      cycle_number = next_cycle,
      revision = revision + 1,
      updated_at = now(),
      updated_by = me
    where room_id = p_room_id
    returning * into t;
  end if;

  return t;
end;
$$;

revoke all on function public.reconcile_room_timer(uuid) from public;
grant execute on function public.reconcile_room_timer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Host timer commands (optimistic revision lock)
-- ---------------------------------------------------------------------------
create or replace function public.room_timer_command(
  p_room_id uuid,
  p_action text,
  p_expected_revision bigint
)
returns public.study_room_timer_state
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
  t public.study_room_timer_state%rowtype;
  rem integer;
  dur integer;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into r from public.study_rooms where id = p_room_id for update;
  if r.id is null or r.status <> 'active' then
    raise exception 'Room not active';
  end if;
  if r.host_id <> me then
    raise exception 'Only the host can control the timer';
  end if;

  -- Reconcile first so host commands apply to current phase
  perform public.reconcile_room_timer(p_room_id);

  select * into t
  from public.study_room_timer_state
  where room_id = p_room_id
  for update;

  -- After reconcile, reject mismatched revisions (except reset).
  if p_action <> 'reset' and t.revision <> p_expected_revision then
    raise exception 'STALE_REVISION:%', t.revision;
  end if;

  if p_action = 'start' then
    if t.run_state <> 'idle' and t.phase <> 'idle' then
      raise exception 'Timer already started';
    end if;
    dur := r.focus_minutes * 60000;
    update public.study_room_timer_state
    set phase = 'focus',
        run_state = 'running',
        phase_duration_ms = dur,
        phase_started_at = now(),
        phase_ends_at = now() + (dur || ' milliseconds')::interval,
        remaining_ms_when_paused = null,
        cycle_number = greatest(cycle_number, 1),
        revision = revision + 1,
        updated_at = now(),
        updated_by = me
    where room_id = p_room_id
    returning * into t;

  elsif p_action = 'pause' then
    if t.run_state <> 'running' or t.phase_ends_at is null then
      raise exception 'Timer is not running';
    end if;
    rem := greatest(0, floor(extract(epoch from (t.phase_ends_at - now())) * 1000)::integer);
    update public.study_room_timer_state
    set run_state = 'paused',
        remaining_ms_when_paused = rem,
        phase_started_at = null,
        phase_ends_at = null,
        revision = revision + 1,
        updated_at = now(),
        updated_by = me
    where room_id = p_room_id
    returning * into t;

  elsif p_action = 'resume' then
    if t.run_state <> 'paused' or t.remaining_ms_when_paused is null then
      raise exception 'Timer is not paused';
    end if;
    rem := t.remaining_ms_when_paused;
    update public.study_room_timer_state
    set run_state = 'running',
        phase_started_at = now(),
        phase_ends_at = now() + (rem || ' milliseconds')::interval,
        remaining_ms_when_paused = null,
        revision = revision + 1,
        updated_at = now(),
        updated_by = me
    where room_id = p_room_id
    returning * into t;

  elsif p_action = 'skip' then
    -- Force phase end → reconcile advances
    if t.phase not in ('focus', 'short_break', 'long_break') then
      raise exception 'Nothing to skip';
    end if;
    update public.study_room_timer_state
    set run_state = 'running',
        phase_ends_at = now(),
        remaining_ms_when_paused = null,
        revision = revision + 1,
        updated_at = now(),
        updated_by = me
    where room_id = p_room_id;
    select * into t from public.reconcile_room_timer(p_room_id);

  elsif p_action = 'reset' then
    update public.study_room_timer_state
    set phase = 'idle',
        run_state = 'idle',
        phase_duration_ms = 0,
        phase_started_at = null,
        phase_ends_at = null,
        remaining_ms_when_paused = null,
        cycle_number = 0,
        completed_focus_intervals = 0,
        revision = revision + 1,
        updated_at = now(),
        updated_by = me
    where room_id = p_room_id
    returning * into t;

  elsif p_action = 'next_cycle' then
    if t.phase <> 'idle' and t.run_state <> 'idle' then
      -- skip current into next focus via skip logic
      update public.study_room_timer_state
      set run_state = 'running',
          phase_ends_at = now(),
          remaining_ms_when_paused = null,
          revision = revision + 1,
          updated_at = now(),
          updated_by = me
      where room_id = p_room_id;
      select * into t from public.reconcile_room_timer(p_room_id);
    else
      dur := r.focus_minutes * 60000;
      update public.study_room_timer_state
      set phase = 'focus',
          run_state = 'running',
          phase_duration_ms = dur,
          phase_started_at = now(),
          phase_ends_at = now() + (dur || ' milliseconds')::interval,
          remaining_ms_when_paused = null,
          cycle_number = cycle_number + 1,
          revision = revision + 1,
          updated_at = now(),
          updated_by = me
      where room_id = p_room_id
      returning * into t;
    end if;
  else
    raise exception 'Unknown action';
  end if;

  return t;
end;
$$;

revoke all on function public.room_timer_command(uuid, text, bigint) from public;
grant execute on function public.room_timer_command(uuid, text, bigint) to authenticated;

-- Update durations while idle
create or replace function public.update_study_room_settings(
  p_room_id uuid,
  p_name text default null,
  p_description text default null,
  p_visibility public.study_room_visibility default null,
  p_max_participants integer default null,
  p_focus_minutes integer default null,
  p_short_break_minutes integer default null,
  p_long_break_minutes integer default null,
  p_intervals_before_long integer default null,
  p_chat_enabled boolean default null,
  p_members_can_invite boolean default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.study_rooms%rowtype;
  t public.study_room_timer_state%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select * into r from public.study_rooms where id = p_room_id for update;
  if r.id is null or r.status <> 'active' then
    raise exception 'Room not found';
  end if;
  if r.host_id <> me then
    raise exception 'Only the host can update settings';
  end if;
  select * into t from public.study_room_timer_state where room_id = p_room_id;
  if (p_focus_minutes is not null
      or p_short_break_minutes is not null
      or p_long_break_minutes is not null
      or p_intervals_before_long is not null)
     and t.run_state <> 'idle' then
    raise exception 'Durations can only change while idle';
  end if;

  update public.study_rooms set
    name = coalesce(nullif(trim(p_name), ''), name),
    description = case
      when p_description is null then description
      else nullif(trim(p_description), '')
    end,
    visibility = coalesce(p_visibility, visibility),
    max_participants = coalesce(p_max_participants, max_participants),
    focus_minutes = coalesce(p_focus_minutes, focus_minutes),
    short_break_minutes = coalesce(p_short_break_minutes, short_break_minutes),
    long_break_minutes = coalesce(p_long_break_minutes, long_break_minutes),
    intervals_before_long = coalesce(p_intervals_before_long, intervals_before_long),
    chat_enabled = coalesce(p_chat_enabled, chat_enabled),
    members_can_invite = coalesce(p_members_can_invite, members_can_invite),
    updated_at = now()
  where id = p_room_id;

  return true;
end;
$$;

revoke all on function public.update_study_room_settings(
  uuid, text, text, public.study_room_visibility, integer, integer, integer, integer, integer, boolean, boolean
) from public;
grant execute on function public.update_study_room_settings(
  uuid, text, text, public.study_room_visibility, integer, integer, integer, integer, integer, boolean, boolean
) to authenticated;

-- Rate-limited chat send (max 20 / minute)
create or replace function public.send_study_room_message(
  p_room_id uuid,
  p_body text,
  p_client_message_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  recent integer;
  msg_id uuid;
  existing uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_active_room_member(p_room_id, me) then
    raise exception 'Not a room member';
  end if;
  if not exists (
    select 1 from public.study_rooms
    where id = p_room_id and chat_enabled and status = 'active'
  ) then
    raise exception 'Chat disabled';
  end if;

  select id into existing
  from public.study_room_messages
  where room_id = p_room_id
    and sender_id = me
    and client_message_id = p_client_message_id;
  if existing is not null then
    return existing;
  end if;

  select count(*) into recent
  from public.study_room_messages
  where room_id = p_room_id
    and sender_id = me
    and created_at > now() - interval '1 minute';
  if recent >= 20 then
    raise exception 'Rate limit exceeded';
  end if;

  insert into public.study_room_messages (room_id, sender_id, body, client_message_id)
  values (p_room_id, me, trim(p_body), p_client_message_id)
  returning id into msg_id;

  return msg_id;
end;
$$;

revoke all on function public.send_study_room_message(uuid, text, uuid) from public;
grant execute on function public.send_study_room_message(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime Presence authorization for topic study-room:<uuid>
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'realtime' and table_name = 'messages'
  ) then
    execute $pol$
      drop policy if exists "Study room presence listen" on realtime.messages;
      create policy "Study room presence listen"
      on realtime.messages
      for select
      to authenticated
      using (
        (select realtime.messages.extension) = 'presence'
        and (select realtime.topic()) like 'study-room:%'
        and public.is_active_room_member(
          nullif(replace((select realtime.topic()), 'study-room:', ''), '')::uuid,
          auth.uid()
        )
      );

      drop policy if exists "Study room presence track" on realtime.messages;
      create policy "Study room presence track"
      on realtime.messages
      for insert
      to authenticated
      with check (
        (select realtime.messages.extension) = 'presence'
        and (select realtime.topic()) like 'study-room:%'
        and public.is_active_room_member(
          nullif(replace((select realtime.topic()), 'study-room:', ''), '')::uuid,
          auth.uid()
        )
      );
    $pol$;
  end if;
exception
  when insufficient_privilege then
    raise notice 'Skipping study-room realtime.messages policies (insufficient privilege).';
  when others then
    raise notice 'Skipping study-room realtime policies: %', sqlerrm;
end $$;
