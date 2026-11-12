-- Additive migration: username availability check for signup.
-- Safe to run even if 001_profiles.sql was already applied.

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

comment on function public.username_is_available(text) is
  'Returns true when the username is free. Used during signup before auth.users insert.';
