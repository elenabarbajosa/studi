export const AI_SYLLABUS_FEATURE = "syllabus_import" as const;
export const AI_STUDY_PLAN_FEATURE = "study_plan" as const;

/** Conservative free-tier defaults. */
export const AI_LIMITS = {
  maxPdfBytes: 5 * 1024 * 1024,
  maxPdfPages: 40,
  maxTextChars: 50_000,
  dailyImportsPerUser: 3,
  dailyPlanGenerationsPerUser: 3,
  importSessionTtlHours: 24,
} as const;

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
