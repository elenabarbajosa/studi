import "server-only";

import {
  SYNC_LOOKAHEAD_DAYS,
  SYNC_LOOKBACK_DAYS,
} from "@/lib/calendar-sync/config";
import { fetchAllPages } from "@/lib/data/paged-query";
import { redactForLog } from "@/lib/calendar-sync/crypto";
import {
  resolveConnectionSyncOutcome,
  resolveDiscoveredCalendarEnabled,
} from "@/lib/calendar-sync/microsoft-graph";
import {
  safeDbOpError,
  safeSyncErrorForStorage,
} from "@/lib/calendar-sync/safe-errors";
import { contentHashForEvent } from "@/lib/calendar-sync/hash";
import { googleCalendarProvider } from "@/lib/calendar-sync/providers/google";
import { icloudCalendarProvider } from "@/lib/calendar-sync/providers/icloud";
import { microsoftCalendarProvider } from "@/lib/calendar-sync/providers/microsoft";
import type { CalendarProviderAdapter } from "@/lib/calendar-sync/providers/types";
import {
  loadConnectionTokens,
  saveConnectionTokens,
} from "@/lib/calendar-sync/secrets";
import type {
  ExternalCalendar,
  ExternalCalendarConnection,
  ExternalCalendarProvider,
  ProviderEvent,
  ProviderTokens,
} from "@/lib/calendar-sync/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function adapterFor(
  provider: ExternalCalendarProvider,
): CalendarProviderAdapter | null {
  switch (provider) {
    case "google":
      return googleCalendarProvider;
    case "microsoft":
      return microsoftCalendarProvider;
    case "icloud":
      return icloudCalendarProvider;
    default:
      return null;
  }
}

function syncWindow() {
  const now = Date.now();
  return {
    timeMin: new Date(now - SYNC_LOOKBACK_DAYS * 86_400_000).toISOString(),
    timeMax: new Date(now + SYNC_LOOKAHEAD_DAYS * 86_400_000).toISOString(),
  };
}

async function ensureFreshTokens(
  connection: ExternalCalendarConnection,
  adapter: CalendarProviderAdapter,
  tokens: ProviderTokens,
): Promise<ProviderTokens> {
  const expiresAt = tokens.expiresAt ? new Date(tokens.expiresAt).getTime() : 0;
  const needsRefresh =
    adapter.refreshTokens &&
    tokens.refreshToken &&
    (!expiresAt || expiresAt < Date.now() + 60_000);
  if (!needsRefresh || !adapter.refreshTokens) return tokens;
  const refreshed = await adapter.refreshTokens(tokens);
  await saveConnectionTokens({
    connectionId: connection.id,
    userId: connection.user_id,
    tokens: refreshed,
  });
  return refreshed;
}

function rowFromProviderEvent(
  userId: string,
  connectionId: string,
  calendarId: string,
  event: ProviderEvent,
) {
  return {
    user_id: userId,
    connection_id: connectionId,
    calendar_id: calendarId,
    provider_event_id: event.providerEventId,
    ical_uid: event.icalUid ?? null,
    recurrence_id: event.recurrenceId ?? null,
    title: event.title.slice(0, 500),
    description: event.description?.slice(0, 4000) ?? null,
    location: event.location?.slice(0, 500) ?? null,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    all_day: event.allDay,
    timezone: event.timezone ?? null,
    show_as: event.showAs,
    status: event.status ?? null,
    is_cancelled: event.isCancelled,
    html_link: event.htmlLink ?? null,
    recurring: Boolean(event.recurring),
    provider_updated_at: event.providerUpdatedAt ?? null,
    content_hash: contentHashForEvent(event),
  };
}

export type SyncConnectionResult = {
  ok: boolean;
  connectionId: string;
  upserted: number;
  deleted: number;
  error?: string;
  needsReauth?: boolean;
  /** True when some calendars synced and others failed. */
  partial?: boolean;
  succeededCalendars?: number;
  failedCalendars?: number;
};

export async function syncConnection(
  supabase: Supabase,
  connection: ExternalCalendarConnection,
  options?: { calendarIds?: string[]; tokens?: ProviderTokens },
): Promise<SyncConnectionResult> {
  const adapter = adapterFor(connection.provider);
  if (!adapter) {
    return {
      ok: false,
      connectionId: connection.id,
      upserted: 0,
      deleted: 0,
      error: "This provider does not support automatic sync.",
    };
  }

  await supabase
    .from("external_calendar_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", connection.id)
    .eq("user_id", connection.user_id);

  try {
    let tokens =
      options?.tokens ??
      (await loadConnectionTokens({
        connectionId: connection.id,
        userId: connection.user_id,
      }));
    tokens = await ensureFreshTokens(connection, adapter, tokens);

    const { data: calendars, error: calErr } = await supabase
      .from("external_calendars")
      .select("*")
      .eq("connection_id", connection.id)
      .eq("user_id", connection.user_id)
      .eq("enabled", true);
    if (calErr) throw new Error(safeDbOpError("List calendars", calErr));

    let targets = (calendars ?? []) as ExternalCalendar[];
    if (options?.calendarIds?.length) {
      targets = targets.filter((c) => options.calendarIds!.includes(c.id));
    }

    let upserted = 0;
    let deleted = 0;
    const window = syncWindow();
    const calendarErrors: Array<{ name: string; message: string }> = [];
    let succeededCalendars = 0;

    for (const calendar of targets) {
      try {
        let result = await adapter.fetchEvents(
          tokens,
          {
            providerCalendarId: calendar.provider_calendar_id,
            syncToken: calendar.sync_token,
            ctag: calendar.ctag,
            isPrimary: calendar.is_primary,
          },
          window,
        );

        if (result.fullResyncRequired) {
          await supabase
            .from("external_calendars")
            .update({ sync_token: null, ctag: null })
            .eq("id", calendar.id)
            .eq("user_id", connection.user_id);
          result = await adapter.fetchEvents(
            tokens,
            {
              providerCalendarId: calendar.provider_calendar_id,
              syncToken: null,
              ctag: null,
              isPrimary: calendar.is_primary,
            },
            window,
          );
        }

        const rows = result.events.map((e) =>
          rowFromProviderEvent(
            connection.user_id,
            connection.id,
            calendar.id,
            e,
          ),
        );
        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 100) {
            const chunk = rows.slice(i, i + 100);
            const { error } = await supabase
              .from("external_calendar_events")
              .upsert(chunk, { onConflict: "calendar_id,provider_event_id" });
            if (error) throw new Error(safeDbOpError("Upsert events", error));
            upserted += chunk.length;
          }
        }

        if (result.deletedProviderEventIds.length > 0) {
          const { error, count } = await supabase
            .from("external_calendar_events")
            .delete({ count: "exact" })
            .eq("calendar_id", calendar.id)
            .eq("user_id", connection.user_id)
            .in("provider_event_id", result.deletedProviderEventIds);
          if (error) throw new Error(safeDbOpError("Delete events", error));
          deleted += count ?? result.deletedProviderEventIds.length;
        }

        // iCloud windowed reconcile: when ctag changes, remove events in window
        // that were not returned (approx deletions).
        if (
          connection.provider === "icloud" &&
          result.nextCtag &&
          result.nextCtag !== calendar.ctag
        ) {
          const keep = new Set(result.events.map((e) => e.providerEventId));
          const existing = await fetchAllPages<{
            id: string;
            provider_event_id: string;
          }>((from, to) =>
            supabase
              .from("external_calendar_events")
              .select("id, provider_event_id, starts_at")
              .eq("calendar_id", calendar.id)
              .eq("user_id", connection.user_id)
              .gte("starts_at", window.timeMin)
              .lte("starts_at", window.timeMax)
              .order("id", { ascending: true })
              .range(from, to),
          );
          if (existing.error) {
            throw new Error(safeDbOpError("List events for reconcile", { message: existing.error }));
          }
          const toDelete = existing.data
            .filter((e) => !keep.has(e.provider_event_id))
            .map((e) => e.id);
          if (toDelete.length > 0) {
            const { error } = await supabase
              .from("external_calendar_events")
              .delete()
              .in("id", toDelete)
              .eq("user_id", connection.user_id);
            if (!error) deleted += toDelete.length;
          }
        }

        await supabase
          .from("external_calendars")
          .update({
            sync_token: result.nextSyncToken ?? calendar.sync_token,
            ctag: result.nextCtag ?? calendar.ctag,
            last_sync_at: new Date().toISOString(),
            last_successful_sync_at: new Date().toISOString(),
            last_sync_error: null,
          })
          .eq("id", calendar.id)
          .eq("user_id", connection.user_id);
        succeededCalendars += 1;
      } catch (calErr) {
        const code = (calErr as Error & { code?: string }).code;
        if (code === "needs_reauth") throw calErr;

        const message = safeSyncErrorForStorage(calErr);
        calendarErrors.push({
          name: calendar.name || "Calendar",
          message,
        });
        console.error(
          "calendar sync calendar failed",
          redactForLog({
            connectionId: connection.id,
            calendarId: calendar.id,
            message,
            graphCode: (calErr as Error & { graphCode?: string }).graphCode,
          }),
        );
        // Record failure without marking successful or clearing events/sync cursor.
        await supabase
          .from("external_calendars")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_error: message,
          })
          .eq("id", calendar.id)
          .eq("user_id", connection.user_id);
      }
    }

    const failedCalendars = calendarErrors.length;
    const outcome = resolveConnectionSyncOutcome({
      targetCount: targets.length,
      succeeded: succeededCalendars,
      calendarErrors,
    });

    await supabase
      .from("external_calendar_connections")
      .update({
        status: outcome.status,
        last_sync_at: new Date().toISOString(),
        ...(outcome.updateLastSuccessful
          ? { last_successful_sync_at: new Date().toISOString() }
          : {}),
        last_sync_error: outcome.error,
      })
      .eq("id", connection.id)
      .eq("user_id", connection.user_id);

    return {
      ok: outcome.ok,
      connectionId: connection.id,
      upserted,
      deleted,
      partial: outcome.partial,
      error: outcome.error ?? undefined,
      succeededCalendars,
      failedCalendars,
    };
  } catch (err) {
    const message = safeSyncErrorForStorage(err);
    const code = (err as Error & { code?: string }).code;
    const needsReauth = code === "needs_reauth";
    console.error(
      "calendar sync failed",
      redactForLog({ connectionId: connection.id, message, code }),
    );
    await supabase
      .from("external_calendar_connections")
      .update({
        status: needsReauth ? "needs_reauth" : "error",
        last_sync_at: new Date().toISOString(),
        last_sync_error: message,
      })
      .eq("id", connection.id)
      .eq("user_id", connection.user_id);
    return {
      ok: false,
      connectionId: connection.id,
      upserted: 0,
      deleted: 0,
      error: message,
      needsReauth,
    };
  }
}

/**
 * Discover provider calendars. Preserves an existing calendar's `enabled`
 * flag so user selections survive reconnect. New calendars use
 * `enablePrimaryOnly` when set (Microsoft first connect).
 */
export async function discoverAndStoreCalendars(
  supabase: Supabase,
  connection: ExternalCalendarConnection,
  tokens: ProviderTokens,
  options?: { enablePrimaryOnly?: boolean },
) {
  const adapter = adapterFor(connection.provider);
  if (!adapter) throw new Error("Unsupported provider.");
  const calendars = await adapter.listCalendars(tokens);

  const { data: existingRows } = await supabase
    .from("external_calendars")
    .select("provider_calendar_id, enabled")
    .eq("connection_id", connection.id)
    .eq("user_id", connection.user_id);
  const existingEnabled = new Map(
    (existingRows ?? []).map((r) => [
      r.provider_calendar_id as string,
      r.enabled as boolean,
    ]),
  );
  const hasExisting = existingEnabled.size > 0;

  for (const cal of calendars) {
    const enabled = resolveDiscoveredCalendarEnabled({
      providerCalendarId: cal.id,
      isPrimary: Boolean(cal.isPrimary),
      existingEnabled,
      enablePrimaryOnly: options?.enablePrimaryOnly,
    });

    await supabase.from("external_calendars").upsert(
      {
        user_id: connection.user_id,
        connection_id: connection.id,
        provider_calendar_id: cal.id,
        name: cal.name,
        color: cal.color ?? null,
        timezone: cal.timezone ?? null,
        enabled,
        is_primary: Boolean(cal.isPrimary),
      },
      { onConflict: "connection_id,provider_calendar_id" },
    );
  }

  // If primary-only first connect found no primary enabled, enable the first calendar.
  if (!hasExisting && options?.enablePrimaryOnly) {
    const { data: enabledRows } = await supabase
      .from("external_calendars")
      .select("id")
      .eq("connection_id", connection.id)
      .eq("user_id", connection.user_id)
      .eq("enabled", true)
      .limit(1);
    if (!enabledRows?.length && calendars[0]) {
      await supabase
        .from("external_calendars")
        .update({ enabled: true })
        .eq("connection_id", connection.id)
        .eq("user_id", connection.user_id)
        .eq("provider_calendar_id", calendars[0].id);
    }
  }

  return calendars;
}

export {
  saveConnectionTokens as saveTokens,
  loadConnectionTokens as loadTokens,
  adapterFor,
};
