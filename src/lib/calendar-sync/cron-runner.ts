import type { ExternalConnectionStatus } from "@/lib/calendar-sync/types";

/** Max connections fetched per DB round-trip inside one cron invocation. */
export const SYNC_CRON_FETCH_BATCH = 20;
/** Hard cap per invocation so Hobby time limits are respected. */
export const SYNC_CRON_MAX_CONNECTIONS = 80;
/** Stop claiming new work before typical Hobby/Pro soft timeouts. */
export const SYNC_CRON_TIME_BUDGET_MS = 50_000;
/**
 * Skip connections touched this recently so overlapping cron/manual runs
 * do not re-process the same rows.
 */
export const SYNC_CRON_OVERLAP_COOLDOWN_MS = 20 * 60_000;

/** Statuses the daily cron will attempt (needs_reauth requires user reconnect). */
export const SYNC_CRON_ELIGIBLE_STATUSES: ExternalConnectionStatus[] = [
  "active",
  "error",
];

export type CronConnectionCandidate = {
  id: string;
  status: ExternalConnectionStatus | string;
  last_sync_at: string | null;
  provider: string;
};

export function isCronEligibleStatus(status: string): boolean {
  return (SYNC_CRON_ELIGIBLE_STATUSES as string[]).includes(status);
}

export function isStaleEnoughForCronClaim(
  lastSyncAt: string | null,
  nowMs: number,
  cooldownMs = SYNC_CRON_OVERLAP_COOLDOWN_MS,
): boolean {
  if (!lastSyncAt) return true;
  const t = Date.parse(lastSyncAt);
  if (Number.isNaN(t)) return true;
  return nowMs - t >= cooldownMs;
}

export function filterCronCandidates(
  connections: readonly CronConnectionCandidate[],
  nowMs: number,
  cooldownMs = SYNC_CRON_OVERLAP_COOLDOWN_MS,
): CronConnectionCandidate[] {
  return connections
    .filter(
      (c) =>
        isCronEligibleStatus(c.status) &&
        ["google", "microsoft", "icloud"].includes(c.provider) &&
        isStaleEnoughForCronClaim(c.last_sync_at, nowMs, cooldownMs),
    )
    .sort((a, b) => {
      const ta = a.last_sync_at ? Date.parse(a.last_sync_at) : 0;
      const tb = b.last_sync_at ? Date.parse(b.last_sync_at) : 0;
      const aNull = !a.last_sync_at || Number.isNaN(ta);
      const bNull = !b.last_sync_at || Number.isNaN(tb);
      if (aNull && !bNull) return -1;
      if (!aNull && bNull) return 1;
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
    });
}

export function shouldContinueCronLoop(input: {
  processed: number;
  maxConnections: number;
  startedAtMs: number;
  nowMs: number;
  timeBudgetMs: number;
  lastBatchCount: number;
}): boolean {
  if (input.lastBatchCount === 0) return false;
  if (input.processed >= input.maxConnections) return false;
  if (input.nowMs - input.startedAtMs >= input.timeBudgetMs) return false;
  return true;
}

export function nextCronFetchLimit(input: {
  processed: number;
  maxConnections: number;
  fetchBatch: number;
}): number {
  return Math.max(
    0,
    Math.min(input.fetchBatch, input.maxConnections - input.processed),
  );
}

export type CronConnectionResult = {
  ok: boolean;
  partial?: boolean;
  needsReauth?: boolean;
  upserted?: number;
  deleted?: number;
  /** Internal only — never returned verbatim in the public JSON body. */
  error?: string;
};

export type CronRunSummary = {
  ok: true;
  backgroundSyncActive: true;
  processed: number;
  succeeded: number;
  failed: number;
  partial: number;
  needsReauth: number;
  upserted: number;
  deleted: number;
  rounds: number;
  truncatedByBudget: boolean;
};

export function summarizeCronRun(input: {
  results: readonly CronConnectionResult[];
  rounds: number;
  truncatedByBudget: boolean;
}): CronRunSummary {
  let succeeded = 0;
  let failed = 0;
  let partial = 0;
  let needsReauth = 0;
  let upserted = 0;
  let deleted = 0;

  for (const r of input.results) {
    if (r.needsReauth) needsReauth += 1;
    if (r.ok) {
      succeeded += 1;
      if (r.partial) partial += 1;
    } else {
      failed += 1;
    }
    upserted += r.upserted ?? 0;
    deleted += r.deleted ?? 0;
  }

  return {
    ok: true,
    backgroundSyncActive: true,
    processed: input.results.length,
    succeeded,
    failed,
    partial,
    needsReauth,
    upserted,
    deleted,
    rounds: input.rounds,
    truncatedByBudget: input.truncatedByBudget,
  };
}

/** Documents that disabled calendars are never sync targets. */
export function cronSyncsOnlyEnabledCalendars(
  calendars: readonly { enabled: boolean }[],
): { enabled: boolean }[] {
  return calendars.filter((c) => c.enabled);
}
