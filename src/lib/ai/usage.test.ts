import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AiFeatureError } from "@/lib/ai/errors";
import {
  assertClaimAllowed,
  claimSyllabusImportUsage,
  consumeImportSession,
  createImportSession,
  normalizeClaimResult,
} from "@/lib/ai/usage";

describe("normalizeClaimResult / assertClaimAllowed", () => {
  it("normalizes allowed claim rows", () => {
    const result = normalizeClaimResult([{ allowed: true, used: 1, limit: 3 }], 3);
    assert.deepEqual(result, { allowed: true, used: 1, limit: 3, remaining: 2 });
  });

  it("throws when the daily limit is reached", () => {
    assert.throws(
      () => assertClaimAllowed({ allowed: false, used: 3, limit: 3, remaining: 0 }),
      (error: unknown) =>
        error instanceof AiFeatureError && error.code === "rate_limited",
    );
  });
});

describe("claimSyllabusImportUsage", () => {
  it("maps concurrent claim success", async () => {
    const client = {
      rpc: async () => ({
        data: [{ allowed: true, used: 2, limit: 3 }],
        error: null,
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const result = await claimSyllabusImportUsage(client);
    assert.equal(result.remaining, 1);
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
      () => claimSyllabusImportUsage(client),
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
