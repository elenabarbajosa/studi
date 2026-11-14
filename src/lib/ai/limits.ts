export const AI_SYLLABUS_FEATURE = "syllabus_import" as const;
export const AI_STUDY_PLAN_FEATURE = "study_plan" as const;

/** Conservative free-tier defaults for regular users. */
export const AI_LIMITS = {
  maxPdfBytes: 5 * 1024 * 1024,
  maxPdfPages: 40,
  maxTextChars: 50_000,
  /** Standard daily AI requests per feature (syllabus_import / study_plan). */
  dailyPerFeature: 3,
  /** Owner daily AI requests per feature. */
  ownerDailyPerFeature: 100,
  /** @deprecated use dailyPerFeature */
  dailyImportsPerUser: 3,
  /** @deprecated use dailyPerFeature */
  dailyPlanGenerationsPerUser: 3,
  importSessionTtlHours: 24,
} as const;

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * Server-only owner UUID from env. Never accept client-supplied identity.
 * Must match `studi_ai_owner.owner_user_id` in Supabase after migration 013.
 */
export function getOwnerUserId(): string | null {
  const raw = process.env.STUDI_OWNER_USER_ID?.trim();
  if (!raw) return null;
  // UUID v1–v5 loose shape check — reject injection-looking values.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      raw,
    )
  ) {
    return null;
  }
  return raw.toLowerCase();
}

export function isOwnerUserId(userId: string | null | undefined): boolean {
  const owner = getOwnerUserId();
  if (!owner || !userId) return false;
  return owner === userId.trim().toLowerCase();
}

/** Resolve the daily per-feature limit for a verified auth user id. */
export function resolveAiDailyLimit(userId: string): number {
  return isOwnerUserId(userId)
    ? AI_LIMITS.ownerDailyPerFeature
    : AI_LIMITS.dailyPerFeature;
}
