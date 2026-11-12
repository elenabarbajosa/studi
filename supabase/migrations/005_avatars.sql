-- Studi: profile avatars, preference model, and Storage bucket policies
-- Run AFTER 001–004. Do not edit prior migrations.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'avatar_preference') then
    create type public.avatar_preference as enum ('custom', 'google', 'initials');
  end if;
  if not exists (select 1 from pg_type where typname = 'avatar_visibility') then
    create type public.avatar_visibility as enum ('private', 'friends', 'public');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profile columns (non-breaking)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists google_avatar_url text,
  add column if not exists avatar_preference public.avatar_preference
    not null default 'initials',
  add column if not exists avatar_visibility public.avatar_visibility
    not null default 'private';

alter table public.profiles
  drop constraint if exists profiles_avatar_path_length;
alter table public.profiles
  add constraint profiles_avatar_path_length
  check (avatar_path is null or char_length(avatar_path) between 1 and 512);

alter table public.profiles
  drop constraint if exists profiles_google_avatar_url_length;
alter table public.profiles
  add constraint profiles_google_avatar_url_length
  check (
    google_avatar_url is null
    or char_length(google_avatar_url) between 1 and 2048
  );

comment on column public.profiles.avatar_path is
  'Supabase Storage object path in the avatars bucket (not a signed URL).';
comment on column public.profiles.google_avatar_url is
  'External Google profile image URL when available.';
comment on column public.profiles.avatar_preference is
  'Which avatar source to display: custom upload, Google, or initials.';
comment on column public.profiles.avatar_visibility is
  'Prepared for friends/public sharing. Default private; Storage stays owner-readable.';

-- Backfill from legacy avatar_url (Google OAuth often stored the picture there).
update public.profiles
set
  google_avatar_url = coalesce(
    google_avatar_url,
    case
      when avatar_url is not null
        and (
          avatar_url ilike '%googleusercontent.com%'
          or avatar_url ilike '%ggpht.com%'
        )
      then avatar_url
      else null
    end
  ),
  avatar_preference = case
    when avatar_preference <> 'initials' then avatar_preference
    when avatar_url is not null
      and (
        avatar_url ilike '%googleusercontent.com%'
        or avatar_url ilike '%ggpht.com%'
      )
    then 'google'::public.avatar_preference
    else avatar_preference
  end
where google_avatar_url is null
   or avatar_preference = 'initials';

-- ---------------------------------------------------------------------------
-- Signup trigger: capture Google picture without forcing custom uploads
-- ---------------------------------------------------------------------------
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
    avatar_visibility
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
    'private'
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage bucket: private avatars with owner-only access
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Paths must be: {auth.uid()}/filename
drop policy if exists "Avatar owners can select own files" on storage.objects;
create policy "Avatar owners can select own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Avatar owners can upload own files" on storage.objects;
create policy "Avatar owners can upload own files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
-- File size is capped by the bucket file_size_limit (5 MB) and server-side validation.

drop policy if exists "Avatar owners can update own files" on storage.objects;
create policy "Avatar owners can update own files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Avatar owners can delete own files" on storage.objects;
create policy "Avatar owners can delete own files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
