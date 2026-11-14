export type AiErrorCode =
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "invalid_input"
  | "rate_limited"
  | "quota_exhausted"
  | "model_error"
  | "parse_error"
  | "session_invalid"
  | "migration_missing"
  | "unknown";

export class AiFeatureError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;

  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AiFeatureError";
    this.code = code;
    this.status = status;
  }
}

export function mapGeminiError(error: unknown): AiFeatureError {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Gemini request failed.";

  const lower = message.toLowerCase();

  if (
    status === 429 ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    return new AiFeatureError(
      "quota_exhausted",
      "Gemini free-tier quota is exhausted for now. Try again later — Studi will not switch to a paid model automatically.",
      status ?? 429,
    );
  }

  if (status === 401 || status === 403 || lower.includes("unauthenticated") || lower.includes("permission")) {
    return new AiFeatureError(
      "forbidden",
      "Gemini rejected this API key or project permission. Check the key in Google AI Studio.",
      status,
    );
  }

  if (lower.includes("api key") || lower.includes("gemini_api_key")) {
    return new AiFeatureError(
      "not_configured",
      "Gemini is not configured on the server.",
      status,
    );
  }

  return new AiFeatureError("model_error", "Could not extract the syllabus with AI. Please try again.", status);
}

export function mapUsageClaimError(error: { message?: string; code?: string } | null): AiFeatureError | null {
  if (!error) return null;
  const msg = error.message ?? "";
  if (
    error.code === "PGRST202" ||
    msg.includes("claim_ai_usage") ||
    msg.includes("Could not find the function") ||
    msg.includes("schema cache")
  ) {
    return new AiFeatureError(
      "migration_missing",
      "AI usage tracking is not set up yet. Apply migration 011_phase9_ai_syllabus.sql in Supabase, then try again.",
    );
  }
  return new AiFeatureError("unknown", msg || "Could not check AI usage limits.");
}

export function userMessageFromAiError(error: unknown): string {
  if (error instanceof AiFeatureError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong with the AI import.";
}
