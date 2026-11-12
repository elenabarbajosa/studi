-- Studi Phase 1: profiles, theme preferences, and RLS
-- Run this in the Supabase SQL editor or via the Supabase CLI.

create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appearance_mode') then
    create type public.appearance_mode as enum ('light', 'dark', 'system');
  end if;
  if not exists (select 1 from pg_type where typname = 'accent_color') then
    create type public.accent_color as enum (
      'pink',
      'blue',
      'green',
      'purple',
      'peach',
      'neutral'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null,
  display_name text,
  avatar_url text,
  bio text,
  appearance public.appearance_mode not null default 'system',
  accent_color public.accent_color not null default 'pink',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (
    char_length(username::text) between 3 and 24
  ),
  constraint profiles_username_format check (
    username::text ~ '^[a-z0-9_]+$'
  ),
  constraint profiles_bio_length check (
    bio is null or char_length(bio) <= 280
  )
);

create unique index if not exists profiles_username_key
  on public.profiles (username);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Create a profile row when a user signs up.
-- Username / display_name can be supplied via auth metadata.
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

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      initcap(replace(candidate, '_', ' '))
    ),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Profiles are deletable by owner" on public.profiles;
create policy "Profiles are deletable by owner"
on public.profiles
for delete
to authenticated
using (auth.uid() = id);

-- Phase 1: profiles stay private. Public friend lookups arrive in a later phase.
revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.profiles to authenticated;

-- Username availability for signup (also in 002 for projects that already ran 001).
create or replace function public.username_is_available(desired text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where username = lower(desired)::citext
  );
$$;

revoke all on function public.username_is_available(text) from public;
grant execute on function public.username_is_available(text) to anon, authenticated;
