-- =============================================================================
-- 022 — Focus active session sync (revision + Realtime)
--
-- Enables authoritative cross-device Focus/Pomodoro synchronization:
-- 1. revision column for optimistic concurrency (stale clients cannot overwrite)
-- 2. Realtime publication so other devices receive live updates
--
-- RLS already restricts rows to auth.uid() = user_id (from 006).
-- =============================================================================

alter table public.focus_active_sessions
  add column if not exists revision bigint not null default 1
    check (revision >= 1);

comment on column public.focus_active_sessions.revision is
  'Monotonic optimistic-concurrency token. Clients send expected_revision; stale writes fail.';

create index if not exists focus_active_sessions_user_revision_idx
  on public.focus_active_sessions (user_id, revision);

-- Realtime: authenticated clients already pass SELECT RLS (own rows only).
do $$
begin
  alter publication supabase_realtime add table public.focus_active_sessions;
exception
  when duplicate_object then
    raise notice 'focus_active_sessions already in supabase_realtime';
  when undefined_object then
    raise notice 'supabase_realtime publication missing: %', sqlerrm;
end $$;
