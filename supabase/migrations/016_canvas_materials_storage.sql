-- Studi: Canvas course importer — private file storage + material file fields
-- Run AFTER 001–015. Do NOT apply automatically from the app.
--
-- Apply in the Supabase SQL editor or via CLI before using Import from Canvas.
-- Creates private buckets `course-materials` and `canvas-staging` with owner-only
-- RLS on storage.objects paths prefixed by auth.uid().
--
-- Free-tier notes:
-- - Supabase free storage is limited (~1 GB). Prefer selective imports.
-- - Vercel hobby request bodies are ~4.5 MB; archives up to 25 MB use staging
--   upload (createSignedUploadUrl) then server-side scan.
-- - Staging objects should be cleaned up after import (app does this); orphaned
--   staging files older than 24h may be deleted manually.

-- ---------------------------------------------------------------------------
-- Materials: support stored files (url optional when storage_path set)
-- ---------------------------------------------------------------------------

alter table public.materials
  alter column url drop not null;

alter table public.materials
  drop constraint if exists materials_url_length;
alter table public.materials
  add constraint materials_url_length
  check (url is null or char_length(url) between 1 and 2000);

alter table public.materials
  add column if not exists storage_path text,
  add column if not exists storage_bucket text,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists source text not null default 'manual',
  add column if not exists source_fingerprint text,
  add column if not exists canvas_module_path text;

alter table public.materials
  drop constraint if exists materials_storage_path_length;
alter table public.materials
  add constraint materials_storage_path_length
  check (storage_path is null or char_length(storage_path) between 1 and 512);

alter table public.materials
  drop constraint if exists materials_storage_bucket_length;
alter table public.materials
  add constraint materials_storage_bucket_length
  check (storage_bucket is null or char_length(storage_bucket) between 1 and 64);

alter table public.materials
  drop constraint if exists materials_original_filename_length;
alter table public.materials
  add constraint materials_original_filename_length
  check (original_filename is null or char_length(original_filename) between 1 and 260);

alter table public.materials
  drop constraint if exists materials_mime_type_length;
alter table public.materials
  add constraint materials_mime_type_length
  check (mime_type is null or char_length(mime_type) between 1 and 120);

alter table public.materials
  drop constraint if exists materials_byte_size_nonneg;
alter table public.materials
  add constraint materials_byte_size_nonneg
  check (byte_size is null or byte_size >= 0);

alter table public.materials
  drop constraint if exists materials_source_check;
alter table public.materials
  add constraint materials_source_check
  check (source in ('manual', 'canvas', 'link'));

alter table public.materials
  drop constraint if exists materials_source_fingerprint_length;
alter table public.materials
  add constraint materials_source_fingerprint_length
  check (source_fingerprint is null or char_length(source_fingerprint) between 1 and 128);

alter table public.materials
  drop constraint if exists materials_canvas_module_path_length;
alter table public.materials
  add constraint materials_canvas_module_path_length
  check (canvas_module_path is null or char_length(canvas_module_path) <= 500);

-- Exactly one of url or storage_path must be present for a usable material.
alter table public.materials
  drop constraint if exists materials_url_or_storage;
alter table public.materials
  add constraint materials_url_or_storage
  check (
    (url is not null and char_length(url) > 0)
    or (storage_path is not null and storage_bucket is not null)
  );

create unique index if not exists materials_source_fingerprint_uidx
  on public.materials (user_id, subject_id, source_fingerprint)
  where source_fingerprint is not null;

create index if not exists materials_storage_path_idx
  on public.materials (user_id, storage_path)
  where storage_path is not null;

comment on column public.materials.storage_path is
  'Private Storage object path (not a signed URL). Paths are {user_id}/…';
comment on column public.materials.source_fingerprint is
  'Idempotency key for Canvas imports (hash of archive path or external URL).';

-- ---------------------------------------------------------------------------
-- Storage: private course materials
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  20971520, -- 20 MB per object
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/html',
    'text/markdown',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'canvas-staging',
  'canvas-staging',
  false,
  26214400, -- 25 MB archives
  array[
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- course-materials: {auth.uid()}/subjects/{subject_id}/…
drop policy if exists "Course materials owners select" on storage.objects;
create policy "Course materials owners select"
on storage.objects for select to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Course materials owners insert" on storage.objects;
create policy "Course materials owners insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Course materials owners update" on storage.objects;
create policy "Course materials owners update"
on storage.objects for update to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Course materials owners delete" on storage.objects;
create policy "Course materials owners delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- canvas-staging: {auth.uid()}/…
drop policy if exists "Canvas staging owners select" on storage.objects;
create policy "Canvas staging owners select"
on storage.objects for select to authenticated
using (
  bucket_id = 'canvas-staging'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Canvas staging owners insert" on storage.objects;
create policy "Canvas staging owners insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'canvas-staging'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Canvas staging owners update" on storage.objects;
create policy "Canvas staging owners update"
on storage.objects for update to authenticated
using (
  bucket_id = 'canvas-staging'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'canvas-staging'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Canvas staging owners delete" on storage.objects;
create policy "Canvas staging owners delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'canvas-staging'
  and (storage.foldername(name))[1] = auth.uid()::text
);
