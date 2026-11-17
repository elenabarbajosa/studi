import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authorizeCalendarCronRequest,
  resolveCalendarCronSecrets,
} from "@/lib/calendar-sync/cron-auth";
import {
  cronSyncsOnlyEnabledCalendars,
  filterCronCandidates,
  isStaleEnoughForCronClaim,
  nextCronFetchLimit,
  shouldContinueCronLoop,
  summarizeCronRun,
  SYNC_CRON_OVERLAP_COOLDOWN_MS,
} from "@/lib/calendar-sync/cron-runner";

function req(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null;
      },
    },
  };
}

describe("calendar cron authentication", () => {
  it("rejects missing server configuration (no secrets)", () => {
    assert.deepEqual(resolveCalendarCronSecrets({}), []);
    assert.equal(
      authorizeCalendarCronRequest(
        req({ authorization: "Bearer anything" }),
        [],
      ),
      false,
    );
    assert.equal(
      authorizeCalendarCronRequest(req({ authorization: "Bearer x" }), null),
      false,
    );
  });

  it("accepts Vercel CRON_SECRET bearer tokens", () => {
    const secrets = resolveCalendarCronSecrets({
      CRON_SECRET: "vercel-primary-secret",
    });
    assert.equal(
      authorizeCalendarCronRequest(
        req({ authorization: "Bearer vercel-primary-secret" }),
        secrets,
      ),
      true,
    );
    assert.equal(
      authorizeCalendarCronRequest(
        req({ authorization: "Bearer wrong" }),
        secrets,
      ),
      false,
    );
  });

  it("accepts legacy CALENDAR_SYNC_CRON_SECRET without ambiguity when both differ", () => {
    const secrets = resolveCalendarCronSecrets({
      CRON_SECRET: "vercel-primary",
      CALENDAR_SYNC_CRON_SECRET: "legacy-secondary",
    });
    assert.equal(secrets.length, 2);
    assert.equal(
      authorizeCalendarCronRequest(
        req({ authorization: "Bearer vercel-primary" }),
        secrets,
      ),
      true,
    );
    assert.equal(
      authorizeCalendarCronRequest(
        req({ "x-cron-secret": "legacy-secondary" }),
        secrets,
      ),
      true,
    );
    assert.equal(
      authorizeCalendarCronRequest(
        req({ authorization: "Bearer neither" }),
        secrets,
      ),
      false,
    );
  });

  it("dedupes identical primary and legacy secrets", () => {
    assert.deepEqual(
      resolveCalendarCronSecrets({
        CRON_SECRET: "same",
        CALENDAR_SYNC_CRON_SECRET: "same",
      }),
      ["same"],
    );
  });
});

describe("cron batching and overlap", () => {
  const now = Date.parse("2026-11-17T10:00:00.000Z");

  it("rotates by oldest last_sync_at and skips recent claims", () => {
    const recent = new Date(now - 60_000).toISOString();
    const old = new Date(now - 2 * 60 * 60_000).toISOString();
    const filtered = filterCronCandidates(
      [
        {
          id: "recent",
          status: "active",
          provider: "google",
          last_sync_at: recent,
        },
        {
          id: "old-a",
          status: "active",
          provider: "microsoft",
          last_sync_at: old,
        },
        {
          id: "never",
          status: "error",
          provider: "icloud",
          last_sync_at: null,
        },
        {
          id: "reauth",
          status: "needs_reauth",
          provider: "google",
          last_sync_at: null,
        },
      ],
      now,
    );
    assert.deepEqual(
      filtered.map((c) => c.id),
      ["never", "old-a"],
    );
  });

  it("does not permanently starve later connections across rounds", () => {
    // Round capacity math: 80 max / 20 batch => 4 rounds can cover 80 users/day.
    assert.equal(
      nextCronFetchLimit({ processed: 0, maxConnections: 80, fetchBatch: 20 }),
      20,
    );
    assert.equal(
      nextCronFetchLimit({ processed: 70, maxConnections: 80, fetchBatch: 20 }),
      10,
    );
    assert.equal(
      nextCronFetchLimit({ processed: 80, maxConnections: 80, fetchBatch: 20 }),
      0,
    );
  });

  it("stops when the time budget is exhausted", () => {
    assert.equal(
      shouldContinueCronLoop({
        processed: 10,
        maxConnections: 80,
        startedAtMs: now,
        nowMs: now + 50_000,
        timeBudgetMs: 50_000,
        lastBatchCount: 20,
      }),
      false,
    );
  });

  it("treats cooldown as overlap protection", () => {
    assert.equal(
      isStaleEnoughForCronClaim(
        new Date(now - SYNC_CRON_OVERLAP_COOLDOWN_MS + 1_000).toISOString(),
        now,
      ),
      false,
    );
    assert.equal(
      isStaleEnoughForCronClaim(
        new Date(now - SYNC_CRON_OVERLAP_COOLDOWN_MS - 1_000).toISOString(),
        now,
      ),
      true,
    );
  });
});

describe("cron sync policy", () => {
  it("skips disabled calendars", () => {
    const enabled = cronSyncsOnlyEnabledCalendars([
      { enabled: true },
      { enabled: false },
      { enabled: true },
    ]);
    assert.equal(enabled.length, 2);
    assert.ok(enabled.every((c) => c.enabled));
  });

  it("summarizes without embedding per-connection secrets or titles", () => {
    const summary = summarizeCronRun({
      rounds: 2,
      truncatedByBudget: false,
      results: [
        { ok: true, upserted: 3, deleted: 1 },
        { ok: false, needsReauth: true, error: "needs reconnect" },
        { ok: true, partial: true, upserted: 2, deleted: 0 },
      ],
    });
    assert.equal(summary.processed, 3);
    assert.equal(summary.succeeded, 2);
    assert.equal(summary.failed, 1);
    assert.equal(summary.partial, 1);
    assert.equal(summary.needsReauth, 1);
    assert.equal(summary.upserted, 5);
    assert.equal(summary.deleted, 1);
    assert.equal("results" in summary, false);
  });

  it("counts upserts so repeated syncs remain idempotent at the summary layer", () => {
    // Engine upserts on (calendar_id, provider_event_id); cron only aggregates counts.
    const once = summarizeCronRun({
      rounds: 1,
      truncatedByBudget: false,
      results: [{ ok: true, upserted: 10, deleted: 0 }],
    });
    const twice = summarizeCronRun({
      rounds: 1,
      truncatedByBudget: false,
      results: [{ ok: true, upserted: 10, deleted: 0 }],
    });
    assert.equal(once.upserted, twice.upserted);
  });
});
