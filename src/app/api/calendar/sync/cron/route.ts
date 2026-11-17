import { NextResponse } from "next/server";

import {
  getCalendarCronSecrets,
  getCronSecretConfigured,
  isServiceRoleKeyConfigured,
} from "@/lib/calendar-sync/config";
import { authorizeCalendarCronRequest } from "@/lib/calendar-sync/cron-auth";
import {
  SYNC_CRON_ELIGIBLE_STATUSES,
  SYNC_CRON_FETCH_BATCH,
  SYNC_CRON_MAX_CONNECTIONS,
  SYNC_CRON_TIME_BUDGET_MS,
  filterCronCandidates,
  nextCronFetchLimit,
  summarizeCronRun,
  type CronConnectionResult,
} from "@/lib/calendar-sync/cron-runner";
import { syncConnection } from "@/lib/calendar-sync/engine";
import { loadConnectionTokens } from "@/lib/calendar-sync/secrets";
import {
  redactForLog,
  safePublicError,
} from "@/lib/calendar-sync/safe-errors";
import type { ExternalCalendarConnection } from "@/lib/calendar-sync/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Allow multi-batch sync within a daily Hobby-compatible invocation. */
export const maxDuration = 60;

/**
 * Scheduled synchronization endpoint (Vercel Cron).
 *
 * Auth (Bearer or x-cron-secret):
 *   - Primary: CRON_SECRET (Vercel auto-injects Authorization: Bearer …)
 *   - Legacy: CALENDAR_SYNC_CRON_SECRET (optional manual schedulers)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY for multi-user secret access + sync writes.
 */

async function runCalendarCron(request: Request) {
  if (!getCronSecretConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Cron is not configured. Set CRON_SECRET in Vercel (recommended) or CALENDAR_SYNC_CRON_SECRET, then redeploy.",
        backgroundSyncActive: false,
      },
      { status: 503 },
    );
  }

  const secrets = getCalendarCronSecrets();
  if (!authorizeCalendarCronRequest(request, secrets)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isServiceRoleKeyConfigured()) {
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
  const startedAtMs = Date.now();
  const results: CronConnectionResult[] = [];
  let rounds = 0;
  let truncatedByBudget = false;

  while (results.length < SYNC_CRON_MAX_CONNECTIONS) {
    if (Date.now() - startedAtMs >= SYNC_CRON_TIME_BUDGET_MS) {
      truncatedByBudget = true;
      break;
    }

    const limit = nextCronFetchLimit({
      processed: results.length,
      maxConnections: SYNC_CRON_MAX_CONNECTIONS,
      fetchBatch: SYNC_CRON_FETCH_BATCH,
    });
    if (limit <= 0) break;

    // Over-fetch then apply cooldown in JS so PostgREST ISO filters stay simple.
    const { data: connections, error } = await supabase
      .from("external_calendar_connections")
      .select("*")
      .in("status", SYNC_CRON_ELIGIBLE_STATUSES)
      .in("provider", ["google", "microsoft", "icloud"])
      .order("last_sync_at", { ascending: true, nullsFirst: true })
      .limit(Math.min(limit * 3, SYNC_CRON_MAX_CONNECTIONS));

    if (error) {
      console.error(
        "calendar cron list connections",
        redactForLog({ message: error.message }),
      );
      return NextResponse.json(
        { ok: false, error: "Could not list calendar connections." },
        { status: 500 },
      );
    }

    const candidates = filterCronCandidates(
      (connections ?? []) as ExternalCalendarConnection[],
      Date.now(),
    ).slice(0, limit);

    if (candidates.length === 0) break;

    // Claim immediately so a concurrent invocation skips these rows.
    const claimAt = new Date().toISOString();
    const claimIds = candidates.map((c) => c.id);
    await supabase
      .from("external_calendar_connections")
      .update({ last_sync_at: claimAt })
      .in("id", claimIds);

    rounds += 1;
    const byId = new Map(
      ((connections ?? []) as ExternalCalendarConnection[]).map((c) => [
        c.id,
        c,
      ]),
    );

    for (const candidate of candidates) {
      if (Date.now() - startedAtMs >= SYNC_CRON_TIME_BUDGET_MS) {
        truncatedByBudget = true;
        break;
      }

      const connection = byId.get(candidate.id);
      if (!connection) continue;

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
          ok: result.ok,
          partial: result.partial,
          needsReauth: result.needsReauth,
          upserted: result.upserted,
          deleted: result.deleted,
          error: result.error,
        });
        console.info(
          "calendar cron connection",
          redactForLog({
            connectionId: connection.id,
            provider: connection.provider,
            ok: result.ok,
            partial: result.partial,
            needsReauth: result.needsReauth,
            upserted: result.upserted,
            deleted: result.deleted,
            error: result.error,
          }),
        );
      } catch (err) {
        const message = safePublicError(err, "Sync failed");
        console.error(
          "calendar cron sync",
          redactForLog({ connectionId: connection.id, message }),
        );
        results.push({ ok: false, error: message });
      }
    }

    if (truncatedByBudget) break;
    // No further stale work in this window.
    if (candidates.length < limit) break;
  }

  const summary = summarizeCronRun({
    results,
    rounds,
    truncatedByBudget:
      truncatedByBudget || results.length >= SYNC_CRON_MAX_CONNECTIONS,
  });

  console.info(
    "calendar cron summary",
    redactForLog({
      ...summary,
      durationMs: Date.now() - startedAtMs,
    }),
  );

  // Aggregate-only response — no tokens, emails, calendar names, or event payloads.
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  return runCalendarCron(request);
}

export async function GET(request: Request) {
  return runCalendarCron(request);
}
