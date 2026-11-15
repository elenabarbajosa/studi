import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  connectionConflictMessage,
  isUniqueConstraintError,
  resolveOwnedConnectionReuse,
  type ConnectionLookupRow,
} from "@/lib/calendar-sync/connection-reuse";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACCOUNT = "student@icloud.com";

function row(
  partial: Partial<ConnectionLookupRow> & Pick<ConnectionLookupRow, "id" | "user_id">,
): ConnectionLookupRow {
  return {
    provider: "icloud",
    provider_account_id: ACCOUNT,
    status: "pending",
    ...partial,
  };
}

describe("resolveOwnedConnectionReuse", () => {
  it("inserts on first-time connection when no row exists", () => {
    const decision = resolveOwnedConnectionReuse({
      actorUserId: USER_A,
      provider: "icloud",
      providerAccountId: ACCOUNT,
      candidates: [],
    });
    assert.deepEqual(decision, { action: "insert" });
  });

  it("reuses pending/error/active/needs_reauth rows for retry after partial failure", () => {
    for (const status of ["pending", "error", "needs_reauth", "active", "disconnected"] as const) {
      const existing = row({ id: "conn-1", user_id: USER_A, status });
      const decision = resolveOwnedConnectionReuse({
        actorUserId: USER_A,
        provider: "icloud",
        providerAccountId: ACCOUNT,
        candidates: [existing],
      });
      assert.equal(decision.action, "reuse");
      if (decision.action === "reuse") {
        assert.equal(decision.connection.id, "conn-1");
        assert.equal(decision.connection.status, status);
      }
    }
  });

  it("reuses when reconnecting an existing account (same provider account id)", () => {
    const existing = row({
      id: "conn-active",
      user_id: USER_A,
      status: "active",
      provider_account_id: "Student@iCloud.com",
    });
    // Account id matching is trimmed; callers normalize case before lookup.
    const decision = resolveOwnedConnectionReuse({
      actorUserId: USER_A,
      provider: "icloud",
      providerAccountId: "Student@iCloud.com",
      candidates: [existing],
    });
    assert.equal(decision.action, "reuse");
  });

  it("treats concurrent duplicate inserts as reuse once the raced row is visible", () => {
    // Simulates: insert A and insert B race; B gets 23505 then reloads A's row.
    const raced = row({ id: "conn-winner", user_id: USER_A, status: "pending" });
    assert.equal(
      isUniqueConstraintError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "external_calendar_connections_provider_account_unique"',
      }),
      true,
    );
    const decision = resolveOwnedConnectionReuse({
      actorUserId: USER_A,
      provider: "icloud",
      providerAccountId: ACCOUNT,
      candidates: [raced],
    });
    assert.deepEqual(decision, { action: "reuse", connection: raced });
  });

  it("never reuses another user's connection (cross-user isolation)", () => {
    const foreign = row({ id: "conn-b", user_id: USER_B, status: "active" });
    const decision = resolveOwnedConnectionReuse({
      actorUserId: USER_A,
      provider: "icloud",
      providerAccountId: ACCOUNT,
      candidates: [foreign],
    });
    assert.equal(decision.action, "forbidden");
  });

  it("prefers the actor's own row when mixed candidates are present", () => {
    const foreign = row({ id: "conn-b", user_id: USER_B, status: "active" });
    const own = row({ id: "conn-a", user_id: USER_A, status: "error" });
    const decision = resolveOwnedConnectionReuse({
      actorUserId: USER_A,
      provider: "icloud",
      providerAccountId: ACCOUNT,
      candidates: [foreign, own],
    });
    assert.equal(decision.action, "reuse");
    if (decision.action === "reuse") {
      assert.equal(decision.connection.id, "conn-a");
    }
  });

  it("rejects empty account ids", () => {
    assert.equal(
      resolveOwnedConnectionReuse({
        actorUserId: USER_A,
        provider: "icloud",
        providerAccountId: "   ",
        candidates: [],
      }).action,
      "forbidden",
    );
  });

  it("does not reuse a different provider with the same account id", () => {
    const google = row({
      id: "conn-g",
      user_id: USER_A,
      provider: "google",
      status: "active",
    });
    const decision = resolveOwnedConnectionReuse({
      actorUserId: USER_A,
      provider: "icloud",
      providerAccountId: ACCOUNT,
      candidates: [google],
    });
    assert.equal(decision.action, "insert");
  });
});

describe("isUniqueConstraintError", () => {
  it("detects Postgres 23505 and constraint message text", () => {
    assert.equal(isUniqueConstraintError({ code: "23505" }), true);
    assert.equal(
      isUniqueConstraintError({
        message:
          'duplicate key value violates unique constraint "external_calendar_connections_provider_account_unique"',
      }),
      true,
    );
    assert.equal(
      isUniqueConstraintError({ code: "42501", message: "permission denied" }),
      false,
    );
  });
});

describe("connection failure messaging", () => {
  it("keeps conflict copy user-friendly", () => {
    assert.match(connectionConflictMessage("iCloud"), /already linked/i);
  });

  it("hides raw unique-constraint text from safePublicError", async () => {
    const { safePublicError } = await import("@/lib/calendar-sync/safe-errors");
    assert.equal(
      safePublicError(
        {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "external_calendar_connections_provider_account_unique"',
        },
        "Could not save calendar connection.",
      ),
      "Could not save calendar connection.",
    );
  });
});

/**
 * In-memory simulation of upsertOwnedConnection race + recovery without DB.
 * Mirrors the production control flow for failure/recovery assertions.
 */
describe("idempotent connect simulation", () => {
  type StoreRow = ConnectionLookupRow & { calendars: string[]; events: string[] };

  function simulateUpsert(store: StoreRow[], actorUserId: string, accountId: string) {
    const decision = resolveOwnedConnectionReuse({
      actorUserId,
      provider: "icloud",
      providerAccountId: accountId,
      candidates: store.filter((r) => r.user_id === actorUserId),
    });

    if (decision.action === "forbidden") {
      return { ok: false as const, error: "forbidden" };
    }

    if (decision.action === "reuse") {
      const idx = store.findIndex((r) => r.id === decision.connection.id);
      store[idx] = {
        ...store[idx]!,
        status: "pending",
      };
      return {
        ok: true as const,
        reused: true,
        connectionId: store[idx]!.id,
        calendars: store[idx]!.calendars,
        events: store[idx]!.events,
      };
    }

    // Concurrent insert race: pretend another request already inserted.
    const raced = store.find(
      (r) =>
        r.user_id === actorUserId &&
        r.provider === "icloud" &&
        r.provider_account_id === accountId,
    );
    if (raced) {
      assert.equal(isUniqueConstraintError({ code: "23505" }), true);
      raced.status = "pending";
      return {
        ok: true as const,
        reused: true,
        connectionId: raced.id,
        calendars: raced.calendars,
        events: raced.events,
      };
    }

    const created: StoreRow = {
      id: `conn-${store.length + 1}`,
      user_id: actorUserId,
      provider: "icloud",
      provider_account_id: accountId,
      status: "pending",
      calendars: [],
      events: [],
    };
    store.push(created);
    return {
      ok: true as const,
      reused: false,
      connectionId: created.id,
      calendars: created.calendars,
      events: created.events,
    };
  }

  function markActive(store: StoreRow[], connectionId: string, failSetup: boolean) {
    const row = store.find((r) => r.id === connectionId);
    assert.ok(row);
    if (failSetup) {
      row.status = "error";
      return { ok: false as const };
    }
    if (!row.calendars.includes("home")) row.calendars.push("home");
    if (!row.events.includes("evt-1")) row.events.push("evt-1");
    row.status = "active";
    return { ok: true as const };
  }

  it("first connect creates a row; retry after error reuses and preserves calendars/events", () => {
    const store: StoreRow[] = [];
    const first = simulateUpsert(store, USER_A, ACCOUNT);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.reused, false);
    // Partial failure after insert (e.g. credential store / sync).
    markActive(store, first.connectionId, true);
    assert.equal(store[0]!.status, "error");

    // Seed calendars from a later partial success before final active.
    store[0]!.calendars = ["home"];
    store[0]!.events = ["evt-1"];

    const retry = simulateUpsert(store, USER_A, ACCOUNT);
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.reused, true);
    assert.equal(retry.connectionId, first.connectionId);
    assert.deepEqual(retry.calendars, ["home"]);
    assert.deepEqual(retry.events, ["evt-1"]);
    assert.equal(markActive(store, retry.connectionId, false).ok, true);
    assert.equal(store[0]!.status, "active");
    assert.equal(store.length, 1);
  });

  it("simultaneous requests: second insert recovers via unique violation path", () => {
    const store: StoreRow[] = [
      {
        id: "conn-winner",
        user_id: USER_A,
        provider: "icloud",
        provider_account_id: ACCOUNT,
        status: "pending",
        calendars: [],
        events: [],
      },
    ];
    const second = simulateUpsert(store, USER_A, ACCOUNT);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.connectionId, "conn-winner");
    assert.equal(store.length, 1);
  });

  it("user B cannot reuse or mutate user A's connection", () => {
    const storeA: StoreRow[] = [
      {
        id: "conn-a",
        user_id: USER_A,
        provider: "icloud",
        provider_account_id: ACCOUNT,
        status: "active",
        calendars: ["home"],
        events: ["evt-1"],
      },
    ];
    // Lookup is scoped to actor — B sees no candidates → insert new own row.
    const storeB: StoreRow[] = [];
    const created = simulateUpsert(storeB, USER_B, ACCOUNT);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.reused, false);
    assert.notEqual(created.connectionId, "conn-a");
    assert.equal(storeA[0]!.status, "active");
    assert.deepEqual(storeA[0]!.events, ["evt-1"]);

    // Defense-in-depth: foreign-only candidates are forbidden.
    const forbidden = resolveOwnedConnectionReuse({
      actorUserId: USER_B,
      provider: "icloud",
      providerAccountId: ACCOUNT,
      candidates: storeA,
    });
    assert.equal(forbidden.action, "forbidden");
  });
});
