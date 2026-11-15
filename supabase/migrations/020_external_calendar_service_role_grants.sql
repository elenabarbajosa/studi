-- Studi: Explicit service_role grants for external calendar server paths
-- Run AFTER 018–019. Do NOT apply automatically from the app.
--
-- Context:
--   Migration 019 moved encrypted secrets and OAuth state to service-role-only
--   access (no authenticated grants). On current Supabase projects, new public
--   tables are not auto-granted to service_role; BYPASSRLS does not replace
--   table GRANT privileges.
--
--   Core grants (secrets / oauth_states / connections SELECT) may already have
--   been applied manually in Supabase; this file records them for environments
--   that still need them. Additional grants below are required for cron/sync.
--
--   This migration records the grants required for:
--   - saveConnectionTokens / loadConnectionTokens / deleteConnectionTokens
--   - storeCalendarOAuthState / consumeCalendarOAuthState
--   - enforce_external_secret_ownership (SECURITY INVOKER SELECT on connections)
--   - /api/calendar/sync/cron + syncConnection (connections, calendars, events)
--
-- Idempotent: re-running GRANT is safe. Does not change RLS or client privileges.

-- ---------------------------------------------------------------------------
-- Secrets + OAuth state (server-only credential / PKCE storage)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on table public.external_calendar_secrets
  to service_role;

grant select, insert, update, delete
  on table public.calendar_oauth_states
  to service_role;

-- Ownership trigger on secrets selects the parent connection as INVOKER.
grant select
  on table public.external_calendar_connections
  to service_role;

-- ---------------------------------------------------------------------------
-- Sync engine + cron (service-role client performs these operations)
-- ---------------------------------------------------------------------------
-- connections: list due syncs, update status / last_sync_* / errors
grant select, update
  on table public.external_calendar_connections
  to service_role;

-- calendars: list enabled calendars, clear sync tokens, update ctag/sync_token
-- (upsert used when discover runs under a service-role client)
grant select, insert, update, delete
  on table public.external_calendars
  to service_role;

-- events: upsert mirrored events, delete removed/cancelled instances
grant select, insert, update, delete
  on table public.external_calendar_events
  to service_role;

-- Ownership triggers on calendars/events also SELECT parent rows as INVOKER.
-- (connections SELECT already granted above; calendars SELECT covered by CRUD.)
