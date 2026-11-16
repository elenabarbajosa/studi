-- Studi 021: Fix cross-user avatar Storage reads
-- Run AFTER 001–020. Do NOT apply automatically from the app.
--
-- Root cause: policy "Avatar readable when visibility allows" joined
-- public.profiles under the caller's RLS. Profiles SELECT is owner-only, so
-- the EXISTS check never passed for another user's object and createSignedUrl
-- failed for Public/Friends custom avatars.
--
-- Fix: authorize via a SECURITY DEFINER helper that evaluates avatar
-- visibility + friendship + blocks without being blocked by profiles RLS.
-- Bucket stays private; owners keep their existing object policies.

-- ---------------------------------------------------------------------------
-- Authorization helper (used by Storage policy + app-side signed URL minting)
-- ---------------------------------------------------------------------------
create or replace function public.can_read_avatar_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  owner_text text;
  owner_id uuid;
  pref public.avatar_preference;
  vis public.avatar_visibility;
  path text;
begin
  if me is null then
    return false;
  end if;

  if object_name is null or object_name !~ '^[0-9a-f-]{36}/[^/]+$' then
    return false;
  end if;

  owner_text := split_part(object_name, '/', 1);
  begin
    owner_id := owner_text::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  -- Owner always may read their own avatar object.
  if owner_id = me then
    return true;
  end if;

  select p.avatar_preference, p.avatar_visibility, p.avatar_path
  into pref, vis, path
  from public.profiles p
  where p.id = owner_id;

  if not found then
    return false;
  end if;

  if pref is distinct from 'custom' or path is distinct from object_name then
    return false;
  end if;

  if public.is_blocked_either(me, owner_id) then
    return false;
  end if;

  if vis = 'public' then
    return true;
  end if;

  if vis = 'friends' and public.are_friends(me, owner_id) then
    return true;
  end if;

  return false;
end;
$$;

comment on function public.can_read_avatar_object(text) is
  'True when the authenticated viewer may read the given private avatars object path.';

revoke all on function public.can_read_avatar_object(text) from public;
grant execute on function public.can_read_avatar_object(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage policy: use the helper instead of a direct profiles join
-- ---------------------------------------------------------------------------
drop policy if exists "Avatar readable when visibility allows" on storage.objects;
create policy "Avatar readable when visibility allows"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] <> auth.uid()::text
  and public.can_read_avatar_object(name)
);
