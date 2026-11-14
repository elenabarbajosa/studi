import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AiFeatureError,
  mapGeminiError,
  mapUsageClaimError,
  userMessageFromAiError,
} from "@/lib/ai/errors";

describe("mapGeminiError", () => {
  it("maps quota exhaustion without suggesting retries or paid models", () => {
    const err = mapGeminiError({ status: 429, message: "RESOURCE_EXHAUSTED: quota exceeded" });
    assert.equal(err.code, "quota_exhausted");
    assert.match(err.message, /free-tier quota/i);
    assert.match(err.message, /will not switch to a paid model/i);
  });

  it("maps auth failures", () => {
    const err = mapGeminiError({ status: 401, message: "UNAUTHENTICATED" });
    assert.equal(err.code, "forbidden");
  });
});

describe("mapUsageClaimError", () => {
  it("detects missing migration / RPC", () => {
    const err = mapUsageClaimError({
      code: "PGRST202",
      message: "Could not find the function public.claim_ai_usage",
    });
    assert.equal(err?.code, "migration_missing");
    assert.match(err?.message ?? "", /011_phase9_ai_syllabus/);
  });
});

describe("userMessageFromAiError", () => {
  it("prefers AiFeatureError messages", () => {
    assert.equal(
      userMessageFromAiError(new AiFeatureError("rate_limited", "Limit reached")),
      "Limit reached",
    );
  });
});
