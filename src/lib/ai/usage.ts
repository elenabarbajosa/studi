import {
  AI_LIMITS,
  AI_STUDY_PLAN_FEATURE,
  AI_SYLLABUS_FEATURE,
} from "@/lib/ai/limits";
import { AiFeatureError, mapUsageClaimError } from "@/lib/ai/errors";

export type ClaimAiUsageResult = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
};

export function normalizeClaimResult(raw: unknown, fallbackLimit: number): ClaimAiUsageResult {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") {
    throw new AiFeatureError("unknown", "Unexpected AI usage response.");
  }
  const data = row as Record<string, unknown>;
  const allowed = Boolean(data.allowed);
  const used = Number(data.used ?? 0);
  const limit = Number(data.limit ?? fallbackLimit);
  return {
    allowed,
    used: Number.isFinite(used) ? used : 0,
    limit: Number.isFinite(limit) ? limit : fallbackLimit,
    remaining: Math.max(
      0,
      (Number.isFinite(limit) ? limit : fallbackLimit) - (Number.isFinite(used) ? used : 0),
    ),
  };
}

export function assertClaimAllowed(
  result: ClaimAiUsageResult,
  featureLabel = "AI syllabus import",
): ClaimAiUsageResult {
  if (!result.allowed) {
    throw new AiFeatureError(
      "rate_limited",
      `You've reached today's ${featureLabel} limit (${result.limit} per day). Try again tomorrow.`,
    );
  }
  return result;
}

type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

/** Minimal RPC surface so unit tests can mock without the full Supabase client. */
export type AiUsageRpc = {
  rpc(
    fn: "claim_ai_usage",
    args: { p_feature: string; p_daily_limit: number },
  ): PromiseLike<RpcResult>;
  rpc(
    fn: "create_ai_import_session",
    args: { p_subject_id: string; p_feature: string },
  ): PromiseLike<RpcResult>;
  rpc(
    fn: "consume_ai_import_session",
    args: { p_session_id: string; p_subject_id: string },
  ): PromiseLike<RpcResult>;
  rpc(
    fn: "create_ai_generation_session",
    args: { p_feature: string },
  ): PromiseLike<RpcResult>;
  rpc(
    fn: "consume_ai_generation_session",
    args: { p_session_id: string; p_feature: string },
  ): PromiseLike<RpcResult>;
};

export async function claimSyllabusImportUsage(client: AiUsageRpc): Promise<ClaimAiUsageResult> {
  const { data, error } = await client.rpc("claim_ai_usage", {
    p_feature: AI_SYLLABUS_FEATURE,
    p_daily_limit: AI_LIMITS.dailyImportsPerUser,
  });
  const mapped = mapUsageClaimError(error);
  if (mapped) throw mapped;
  return assertClaimAllowed(
    normalizeClaimResult(data, AI_LIMITS.dailyImportsPerUser),
    "AI syllabus import",
  );
}

export async function claimStudyPlanUsage(client: AiUsageRpc): Promise<ClaimAiUsageResult> {
  const { data, error } = await client.rpc("claim_ai_usage", {
    p_feature: AI_STUDY_PLAN_FEATURE,
    p_daily_limit: AI_LIMITS.dailyPlanGenerationsPerUser,
  });
  const mapped = mapUsageClaimError(error);
  if (mapped) throw mapped;
  return assertClaimAllowed(
    normalizeClaimResult(data, AI_LIMITS.dailyPlanGenerationsPerUser),
    "AI study plan generation",
  );
}

export async function createImportSession(
  client: AiUsageRpc,
  subjectId: string,
): Promise<string> {
  const { data, error } = await client.rpc("create_ai_import_session", {
    p_subject_id: subjectId,
    p_feature: AI_SYLLABUS_FEATURE,
  });
  const mapped = mapUsageClaimError(error);
  if (mapped) throw mapped;
  if (typeof data !== "string" || !data) {
    throw new AiFeatureError("unknown", "Could not start an import session.");
  }
  return data;
}

export async function consumeImportSession(
  client: AiUsageRpc,
  sessionId: string,
  subjectId: string,
): Promise<void> {
  const { data, error } = await client.rpc("consume_ai_import_session", {
    p_session_id: sessionId,
    p_subject_id: subjectId,
  });
  const mapped = mapUsageClaimError(error);
  if (mapped) throw mapped;
  if (data !== true) {
    throw new AiFeatureError(
      "session_invalid",
      "This import session expired or was already used. Extract the syllabus again.",
    );
  }
}

export async function createGenerationSession(
  client: AiUsageRpc,
  feature: string,
): Promise<string> {
  const { data, error } = await client.rpc("create_ai_generation_session", {
    p_feature: feature,
  });
  const mapped = mapUsageClaimError(error);
  if (mapped) throw mapped;
  if (typeof data !== "string" || !data) {
    throw new AiFeatureError("unknown", "Could not start a generation session.");
  }
  return data;
}

export async function consumeGenerationSession(
  client: AiUsageRpc,
  sessionId: string,
  feature: string,
): Promise<void> {
  const { data, error } = await client.rpc("consume_ai_generation_session", {
    p_session_id: sessionId,
    p_feature: feature,
  });
  const mapped = mapUsageClaimError(error);
  if (mapped) throw mapped;
  if (data !== true) {
    throw new AiFeatureError(
      "session_invalid",
      "This plan generation session expired or was already used. Generate the plan again.",
    );
  }
}
