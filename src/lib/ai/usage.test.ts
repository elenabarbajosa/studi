import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { AiFeatureError } from "@/lib/ai/errors";
import {
  assertClaimAllowed,
  claimCanvasClassifyUsage,
  claimStudyPlanUsage,
  claimSyllabusImportUsage,
  consumeImportSession,
  createImportSession,
  fetchAiDailyLimit,
  normalizeClaimResult,
} from "@/lib/ai/usage";

const OWNER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER = "11111111-2222-4333-8444-555555555555";

afterEach(() => {
  delete process.env.STUDI_OWNER_USER_ID;
});

describe("normalizeClaimResult / assertClaimAllowed", () => {
  it("normalizes allowed claim rows and prefers RPC limit", () => {
    const result = normalizeClaimResult([{ allowed: true, used: 1, limit: 100 }], 3);
    assert.deepEqual(result, { allowed: true, used: 1, limit: 100, remaining: 99 });
  });

  it("throws when the daily limit is reached", () => {
    assert.throws(
      () => assertClaimAllowed({ allowed: false, used: 3, limit: 3, remaining: 0 }),
      (error: unknown) =>
        error instanceof AiFeatureError && error.code === "rate_limited",
    );
  });

  it("treats concurrent denials as rate_limited with authoritative limit", () => {
    const denied = normalizeClaimResult(
      [{ allowed: false, used: 100, limit: 100 }],
      3,
    );
    assert.equal(denied.allowed, false);
    assert.equal(denied.limit, 100);
    assert.equal(denied.remaining, 0);
    assert.throws(
      () => assertClaimAllowed(denied, "AI study plan generation"),
      (error: unknown) =>
        error instanceof AiFeatureError &&
        error.code === "rate_limited" &&
        /100 per day/.test(error.message),
    );
  });
});

describe("fetchAiDailyLimit", () => {
  it("prefers the DB RPC over env fallback", async () => {
    process.env.STUDI_OWNER_USER_ID = OWNER;
    const client = {
      rpc: async (fn: string) => {
        assert.equal(fn, "get_ai_daily_limit");
        return { data: 100, error: null };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    assert.equal(await fetchAiDailyLimit(client, OWNER), 100);
  });

  it("falls back to env-resolved limit when RPC fails", async () => {
    process.env.STUDI_OWNER_USER_ID = OWNER;
    const client = {
      rpc: async () => ({ data: null, error: { message: "missing" } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    assert.equal(await fetchAiDailyLimit(client, OWNER), 100);
    assert.equal(await fetchAiDailyLimit(client, OTHER), 3);
  });
});

describe("claimSyllabusImportUsage / claimStudyPlanUsage", () => {
  it("claims under the owner limit when RPC reports 100", async () => {
    process.env.STUDI_OWNER_USER_ID = OWNER;
    const calls: unknown[] = [];
    const client = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return {
          data: [{ allowed: true, used: 1, limit: 100 }],
          error: null,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await claimSyllabusImportUsage(client, OWNER);
    assert.equal(result.limit, 100);
    assert.equal(result.remaining, 99);
    assert.deepEqual(calls[0], {
      fn: "claim_ai_usage",
      args: { p_feature: "syllabus_import", p_daily_limit: 100 },
    });
  });

  it("keeps standard users at 3/day even if they want a higher limit", async () => {
    process.env.STUDI_OWNER_USER_ID = OWNER;
    const client = {
      // Simulate post-013 RPC: ignore client p_daily_limit, return standard 3.
      rpc: async (_fn: string, args: { p_daily_limit?: number }) => {
        assert.equal(args.p_daily_limit, 3);
        return {
          data: [{ allowed: true, used: 1, limit: 3 }],
          error: null,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await claimSyllabusImportUsage(client, OTHER);
    assert.equal(result.limit, 3);
    assert.equal(result.remaining, 2);
  });

  it("does not let a non-owner claim succeed at owner capacity via spoofed expectation", async () => {
    process.env.STUDI_OWNER_USER_ID = OWNER;
    // Attacker is OTHER; TypeScript callers must pass auth user id.
    // Even if somehow p_daily_limit were 100, authoritative RPC returns limit 3.
    const client = {
      rpc: async () => ({
        data: [{ allowed: false, used: 3, limit: 3 }],
        error: null,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await assert.rejects(
      () => claimSyllabusImportUsage(client, OTHER),
      (error: unknown) =>
        error instanceof AiFeatureError &&
        error.code === "rate_limited" &&
        /3 per day/.test(error.message),
    );
  });

  it("tracks study_plan independently from syllabus_import", async () => {
    const features: string[] = [];
    const client = {
      rpc: async (_fn: string, args: { p_feature: string }) => {
        features.push(args.p_feature);
        const used = features.filter((f) => f === args.p_feature).length;
        return {
          data: [{ allowed: true, used, limit: 3 }],
          error: null,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const syllabus = await claimSyllabusImportUsage(client, OTHER);
    const plan = await claimStudyPlanUsage(client, OTHER);
    const canvas = await claimCanvasClassifyUsage(client, OTHER);
    assert.deepEqual(features, ["syllabus_import", "study_plan", "canvas_classify"]);
    assert.equal(syllabus.used, 1);
    assert.equal(plan.used, 1);
    assert.equal(canvas.used, 1);
  });

  it("surfaces migration-missing when RPC is absent", async () => {
    const client = {
      rpc: async () => ({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.claim_ai_usage",
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await assert.rejects(
      () => claimSyllabusImportUsage(client, OTHER),
      (error: unknown) =>
        error instanceof AiFeatureError && error.code === "migration_missing",
    );
  });
});

describe("import session idempotency", () => {
  it("creates and consumes a session once", async () => {
    let consumed = false;
    const client = {
      rpc: async (fn: string) => {
        if (fn === "create_ai_import_session") {
          return { data: "11111111-1111-4111-8111-111111111111", error: null };
        }
        if (fn === "consume_ai_import_session") {
          if (consumed) return { data: false, error: null };
          consumed = true;
          return { data: true, error: null };
        }
        return { data: null, error: { message: "unexpected" } };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const sessionId = await createImportSession(client, "subject-1");
    assert.equal(sessionId, "11111111-1111-4111-8111-111111111111");
    await consumeImportSession(client, sessionId, "subject-1");
    await assert.rejects(
      () => consumeImportSession(client, sessionId, "subject-1"),
      (error: unknown) =>
        error instanceof AiFeatureError && error.code === "session_invalid",
    );
  });
});
