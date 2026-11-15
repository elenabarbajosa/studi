import "server-only";

import {
  discoverAndStoreCalendars,
  syncConnection,
} from "@/lib/calendar-sync/engine";
import { safePublicError, safeSyncErrorForStorage } from "@/lib/calendar-sync/safe-errors";
import { saveConnectionTokens } from "@/lib/calendar-sync/secrets";
import type {
  ExternalCalendarConnection,
  ProviderTokens,
} from "@/lib/calendar-sync/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type FinalizeConnectionResult =
  | { ok: true; connectionId: string }
  | { ok: false; error: string; needsReauth?: boolean };

/**
 * Store credentials, discover calendars, run an initial sync, then mark active.
 * On failure leaves the connection in error/needs_reauth (not deleted).
 * Preserves previously discovered calendars/events via upserts.
 */
export async function finalizeExternalConnection(input: {
  supabase: Supabase;
  connection: ExternalCalendarConnection;
  tokens: ProviderTokens;
  discoverOptions?: { enablePrimaryOnly?: boolean };
}): Promise<FinalizeConnectionResult> {
  const { supabase, connection, tokens } = input;

  try {
    await saveConnectionTokens({
      connectionId: connection.id,
      userId: connection.user_id,
      tokens,
    });

    await discoverAndStoreCalendars(
      supabase,
      connection,
      tokens,
      input.discoverOptions,
    );

    const syncResult = await syncConnection(supabase, connection);
    if (!syncResult.ok) {
      await supabase
        .from("external_calendar_connections")
        .update({
          status: syncResult.needsReauth ? "needs_reauth" : "error",
          last_sync_error: safeSyncErrorForStorage(
            syncResult.error ?? "Initial sync failed",
          ),
        })
        .eq("id", connection.id)
        .eq("user_id", connection.user_id);
      return {
        ok: false,
        error: syncResult.error ?? "Connected but initial sync failed.",
        needsReauth: syncResult.needsReauth,
      };
    }

    await supabase
      .from("external_calendar_connections")
      .update({
        status: "active",
        last_successful_sync_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", connection.id)
      .eq("user_id", connection.user_id);

    return { ok: true, connectionId: connection.id };
  } catch (err) {
    const message = safePublicError(err, "Calendar connection setup failed.");
    await supabase
      .from("external_calendar_connections")
      .update({
        status: "error",
        last_sync_error: safeSyncErrorForStorage(err, message),
      })
      .eq("id", connection.id)
      .eq("user_id", connection.user_id);
    return { ok: false, error: message };
  }
}
