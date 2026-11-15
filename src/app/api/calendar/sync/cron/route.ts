import { NextResponse } from "next/server";

import {
  SYNC_BATCH_CONNECTIONS,
  getCronSecretConfigured,
} from "@/lib/calendar-sync/config";
import { authorizeCalendarCronRequest } from "@/lib/calendar-sync/cron-auth";
import { syncConnection } from "@/lib/calendar-sync/engine";
import { loadConnectionTokens } from "@/lib/calendar-sync/secrets";
import {
  redactForLog,
  safePublicError,
} from "@/lib/calendar-sync/safe-errors";
import type { ExternalCalendarConnection } from "@/lib/calendar-sync/types";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

/**
 * Scheduled synchronization endpoint.
 *
 * Auth: Authorization: Bearer $CALENDAR_SYNC_CRON_SECRET
 *   or  x-cron-secret: $CALENDAR_SYNC_CRON_SECRET
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (server-only) for secret access + sync writes.
 */

export async function POST(request: Request) {
  if (!getCronSecretConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Cron is not configured. Set CALENDAR_SYNC_CRON_SECRET and deploy a scheduler.",
        backgroundSyncActive: false,
      },
      { status: 503 },
    );
  }
  if (
    !authorizeCalendarCronRequest(
      request,
      process.env.CALENDAR_SYNC_CRON_SECRET,
    )
  ) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY is required for multi-user scheduled sync.",
        backgroundSyncActive: false,
      },
      { status: 503 },
    );
  }

  const supabase = createServiceRoleClient();

  const { data: connections, error } = await supabase
    .from("external_calendar_connections")
    .select("*")
    .eq("status", "active")
    .in("provider", ["google", "microsoft", "icloud"])
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(SYNC_BATCH_CONNECTIONS);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{
    id: string;
    ok: boolean;
    upserted?: number;
    deleted?: number;
    error?: string;
  }> = [];

  for (const connection of (connections ?? []) as ExternalCalendarConnection[]) {
    try {
      const tokens = await loadConnectionTokens({
        connectionId: connection.id,
        userId: connection.user_id,
      });
      const result = await syncConnection(
        supabase as unknown as Parameters<typeof syncConnection>[0],
        connection,
        { tokens },
      );
      results.push({
        id: connection.id,
        ok: result.ok,
        upserted: result.upserted,
        deleted: result.deleted,
        error: result.error,
      });
    } catch (err) {
      const message = safePublicError(err, "Sync failed");
      console.error(
        "calendar cron sync",
        redactForLog({ connectionId: connection.id, message }),
      );
      results.push({
        id: connection.id,
        ok: false,
        error: message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    backgroundSyncActive: true,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    results,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
