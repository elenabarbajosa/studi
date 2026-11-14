/** Grade component kinds (grading scheme — not calendar assessment types). */
export const GRADE_COMPONENT_TYPES = [
  "midterm",
  "final",
  "quiz",
  "assignment",
  "project",
  "lab",
  "other",
] as const;

export type GradeComponentType = (typeof GRADE_COMPONENT_TYPES)[number];

export const GRADE_COMPONENT_TYPE_META: Record<
  GradeComponentType,
  { label: string }
> = {
  midterm: { label: "Midterm" },
  final: { label: "Final" },
  quiz: { label: "Quiz" },
  assignment: { label: "Assignment" },
  project: { label: "Project" },
  lab: { label: "Lab" },
  other: { label: "Other" },
};

export const GRADE_SCHEME_STATUSES = ["draft", "complete"] as const;
export type GradeSchemeStatus = (typeof GRADE_SCHEME_STATUSES)[number];

/** Absolute tolerance for weight totals (percent points). */
export const WEIGHT_TOTAL_TOLERANCE = 0.05;

/** Internal aggregation uses a 0–100 normalized scale. */
export const NORMALIZED_SCALE = 100;

export type GradeGroupInput = {
  id: string;
  title: string;
  /** Weight of the whole group toward the final grade (0–100). */
  weightPercent: number;
  sortOrder: number;
};

export type GradeComponentInput = {
  id: string;
  title: string;
  componentType: GradeComponentType;
  /**
   * Standalone weight toward final (when groupId is null).
   * Ignored for grouped components — use weightWithinGroup instead.
   */
  weightPercent: number;
  /** Max score on the assessment's own scale (e.g. 100 or 10). */
  maxScore: number;
  /** Actual score on the assessment scale; null = pending. */
  score: number | null;
  /** Optional minimum required on this assessment (same scale as maxScore). */
  minScore: number | null;
  groupId: string | null;
  /** Relative weight inside the group (sums to 100 within the group). */
  weightWithinGroup: number | null;
  sortOrder: number;
  assessmentId: string | null;
  dueAt: string | null;
};

export type GradeSchemeInput = {
  displayScaleMax: number;
  /** Minimum overall grade on the normalized 0–100 scale. */
  passingOverall: number | null;
  /**
   * Minimum normalized grade on every component with type "final".
   * Null = no final-specific floor beyond overall rules.
   */
  passingFinalMin: number | null;
  groups: GradeGroupInput[];
  components: GradeComponentInput[];
};

/** Hypothetical overrides keyed by component id (assessment scale). */
export type GradeScenarioScores = Record<string, number | null>;

export type ComponentContribution = {
  id: string;
  title: string;
  componentType: GradeComponentType;
  effectiveWeight: number;
  maxScore: number;
  actualScore: number | null;
  /** Score used in the current scenario (actual or hypothetical). */
  scenarioScore: number | null;
  normalizedActual: number | null;
  normalizedScenario: number | null;
  /** Weighted points toward final from scenario score (0–100 scale points). */
  weightedPoints: number | null;
  locked: boolean;
  minScore: number | null;
  groupId: string | null;
};

export type GradePassResult = {
  passes: boolean;
  overallMet: boolean | null;
  finalMinMet: boolean | null;
  componentMinsMet: boolean;
  unmetReasons: string[];
};

export type GradeSummary = {
  schemeComplete: boolean;
  totalWeight: number;
  completedWeight: number;
  remainingWeight: number;
  /** Σ (normalized × weight/100) for graded items only. */
  securedPoints: number;
  /**
   * Average of graded work, weight-normalized:
   * securedPoints / completedWeight * 100. Null if nothing graded.
   */
  gradedWorkAverage: number | null;
  /** Projected overall from scenario (null if any pending lacks a scenario score). */
  projectedOverall: number | null;
  /** Best/worst possible overall given locked actuals and free pending [0, max]. */
  possibleRange: { min: number; max: number } | null;
  contributions: ComponentContribution[];
  pass: GradePassResult | null;
};

export type RequiredScoreResult =
  | { status: "guaranteed"; required: null; projected: number }
  | { status: "required"; required: number; projectedAtRequired: number }
  | { status: "impossible"; required: null; reason: string }
  | { status: "insufficient"; required: null; reason: string };
