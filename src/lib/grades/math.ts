import {
  NORMALIZED_SCALE,
  WEIGHT_TOTAL_TOLERANCE,
  type ComponentContribution,
  type GradeComponentInput,
  type GradeGroupInput,
  type GradePassResult,
  type GradeScenarioScores,
  type GradeSchemeInput,
  type GradeSummary,
  type RequiredScoreResult,
} from "@/lib/grades/types";

/** Round up to `decimals` so a displayed minimum never undershoots the true need. */
export function ceilToDecimals(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return value;
  const f = 10 ** decimals;
  return Math.ceil((value - Number.EPSILON) * f) / f;
}

export function roundToDecimals(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) return value;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function normalizeScore(score: number, maxScore: number): number {
  if (!(maxScore > 0)) return 0;
  return (score / maxScore) * NORMALIZED_SCALE;
}

export function denormalizeScore(normalized: number, maxScore: number): number {
  return (normalized / NORMALIZED_SCALE) * maxScore;
}

export function effectiveWeight(
  component: GradeComponentInput,
  groups: GradeGroupInput[],
): number {
  if (!component.groupId) {
    return Math.max(0, component.weightPercent);
  }
  const group = groups.find((g) => g.id === component.groupId);
  if (!group) return 0;
  const within = component.weightWithinGroup ?? 0;
  return Math.max(0, (group.weightPercent * within) / 100);
}

export function totalConfiguredWeight(scheme: GradeSchemeInput): number {
  return scheme.components.reduce(
    (sum, c) => sum + effectiveWeight(c, scheme.groups),
    0,
  );
}

export function isSchemeWeightComplete(scheme: GradeSchemeInput): boolean {
  return Math.abs(totalConfiguredWeight(scheme) - 100) <= WEIGHT_TOTAL_TOLERANCE;
}

export function validateSchemeShape(scheme: GradeSchemeInput): string[] {
  const errors: string[] = [];
  if (!(scheme.displayScaleMax > 0)) {
    errors.push("Display scale must be a positive number.");
  }
  if (
    scheme.passingOverall != null &&
    (scheme.passingOverall < 0 || scheme.passingOverall > NORMALIZED_SCALE)
  ) {
    errors.push("Passing overall must be between 0 and 100 (normalized).");
  }
  if (
    scheme.passingFinalMin != null &&
    (scheme.passingFinalMin < 0 || scheme.passingFinalMin > NORMALIZED_SCALE)
  ) {
    errors.push("Final minimum must be between 0 and 100 (normalized).");
  }

  const seenLinks = new Set<string>();
  for (const c of scheme.components) {
    if (!(c.maxScore > 0)) {
      errors.push(`“${c.title}” must have a positive maximum score.`);
    }
    if (c.weightPercent < 0 || (c.weightWithinGroup ?? 0) < 0) {
      errors.push(`“${c.title}” has a negative weight.`);
    }
    if (c.score != null && (c.score < 0 || c.score > c.maxScore)) {
      errors.push(`“${c.title}” score is outside 0–${c.maxScore}.`);
    }
    if (c.minScore != null && (c.minScore < 0 || c.minScore > c.maxScore)) {
      errors.push(`“${c.title}” minimum is outside 0–${c.maxScore}.`);
    }
    if (c.assessmentId) {
      if (seenLinks.has(c.assessmentId)) {
        errors.push("The same calendar assessment is linked more than once.");
      }
      seenLinks.add(c.assessmentId);
    }
  }

  for (const g of scheme.groups) {
    if (g.weightPercent < 0) {
      errors.push(`Group “${g.title}” has a negative weight.`);
    }
    const children = scheme.components.filter((c) => c.groupId === g.id);
    const within = children.reduce((s, c) => s + (c.weightWithinGroup ?? 0), 0);
    if (children.length && Math.abs(within - 100) > WEIGHT_TOTAL_TOLERANCE) {
      errors.push(
        `Group “${g.title}” internal weights must total 100% (currently ${roundToDecimals(within, 2)}%).`,
      );
    }
  }

  return errors;
}

function scenarioScoreFor(
  component: GradeComponentInput,
  scenario: GradeScenarioScores | undefined,
  options: { lockActuals: boolean; allowActualOverride: boolean },
): { score: number | null; locked: boolean } {
  const hasActual = component.score != null;
  if (hasActual && options.lockActuals && !options.allowActualOverride) {
    return { score: component.score, locked: true };
  }
  if (scenario && Object.prototype.hasOwnProperty.call(scenario, component.id)) {
    const override = scenario[component.id] ?? null;
    if (hasActual && options.lockActuals && !options.allowActualOverride) {
      return { score: component.score, locked: true };
    }
    return {
      score: override,
      locked: hasActual && options.lockActuals,
    };
  }
  return { score: component.score, locked: hasActual };
}

function evaluatePass(
  scheme: GradeSchemeInput,
  contributions: ComponentContribution[],
  projectedOverall: number | null,
): GradePassResult {
  const unmet: string[] = [];
  let overallMet: boolean | null = null;
  let finalMinMet: boolean | null = null;

  if (scheme.passingOverall != null) {
    if (projectedOverall == null) {
      overallMet = null;
    } else {
      overallMet = projectedOverall + 1e-9 >= scheme.passingOverall;
      if (!overallMet) {
        unmet.push(
          `Overall ${roundToDecimals(projectedOverall, 2)}% is below the ${scheme.passingOverall}% pass mark.`,
        );
      }
    }
  }

  if (scheme.passingFinalMin != null) {
    const finals = contributions.filter((c) => c.componentType === "final");
    if (!finals.length) {
      finalMinMet = null;
    } else if (finals.some((f) => f.normalizedScenario == null)) {
      finalMinMet = null;
    } else {
      finalMinMet = true;
      for (const f of finals) {
        if ((f.normalizedScenario ?? 0) + 1e-9 < scheme.passingFinalMin) {
          finalMinMet = false;
          unmet.push(
            `Final “${f.title}” is ${roundToDecimals(f.normalizedScenario ?? 0, 2)}% (needs ≥ ${scheme.passingFinalMin}%).`,
          );
        }
      }
    }
  }

  for (const c of contributions) {
    if (c.minScore == null) continue;
    if (c.scenarioScore == null) continue;
    if (c.scenarioScore + 1e-9 < c.minScore) {
      unmet.push(
        `“${c.title}” is ${roundToDecimals(c.scenarioScore, 2)} (needs ≥ ${c.minScore}).`,
      );
    }
  }

  const overallOk = scheme.passingOverall == null || overallMet === true;
  const finalOk = scheme.passingFinalMin == null || finalMinMet === true;
  const minsOk = scheme.components.every((c) => {
    if (c.minScore == null) return true;
    const row = contributions.find((x) => x.id === c.id);
    return (
      row?.scenarioScore != null && row.scenarioScore + 1e-9 >= c.minScore
    );
  });

  // Only declare pass when every configured requirement is known and met.
  const passes =
    projectedOverall != null &&
    overallOk &&
    finalOk &&
    minsOk &&
    (scheme.passingOverall == null || overallMet === true) &&
    (scheme.passingFinalMin == null || finalMinMet === true);

  // Deduplicate unmet reasons
  const unmetReasons = [...new Set(unmet)];

  return {
    passes,
    overallMet,
    finalMinMet,
    componentMinsMet: minsOk,
    unmetReasons,
  };
}

/**
 * Summarize a grading scheme under an optional what-if scenario.
 * Actual grades are never mutated — scenario is session-local input only.
 */
export function summarizeGrades(
  scheme: GradeSchemeInput,
  scenario?: GradeScenarioScores,
  options?: { lockActuals?: boolean; allowActualOverride?: boolean },
): GradeSummary {
  const lockActuals = options?.lockActuals ?? true;
  const allowActualOverride = options?.allowActualOverride ?? false;
  const schemeComplete = isSchemeWeightComplete(scheme);

  const contributions: ComponentContribution[] = scheme.components
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
    .map((c) => {
      const w = effectiveWeight(c, scheme.groups);
      const { score, locked } = scenarioScoreFor(c, scenario, {
        lockActuals,
        allowActualOverride,
      });
      const normalizedActual =
        c.score == null ? null : normalizeScore(c.score, c.maxScore);
      const normalizedScenario =
        score == null ? null : normalizeScore(score, c.maxScore);
      const weightedPoints =
        normalizedScenario == null ? null : (normalizedScenario * w) / 100;
      return {
        id: c.id,
        title: c.title,
        componentType: c.componentType,
        effectiveWeight: w,
        maxScore: c.maxScore,
        actualScore: c.score,
        scenarioScore: score,
        normalizedActual,
        normalizedScenario,
        weightedPoints,
        locked,
        minScore: c.minScore,
        groupId: c.groupId,
      };
    });

  const totalWeight = contributions.reduce((s, c) => s + c.effectiveWeight, 0);
  const graded = contributions.filter((c) => c.actualScore != null);
  const completedWeight = graded.reduce((s, c) => s + c.effectiveWeight, 0);
  const securedPoints = graded.reduce((s, c) => {
    const n = c.normalizedActual ?? 0;
    return s + (n * c.effectiveWeight) / 100;
  }, 0);
  const gradedWorkAverage =
    completedWeight > 0 ? (securedPoints / completedWeight) * 100 : null;

  const allScenarioKnown = contributions.every(
    (c) => c.effectiveWeight === 0 || c.normalizedScenario != null,
  );
  const projectedOverall = allScenarioKnown
    ? contributions.reduce((s, c) => s + (c.weightedPoints ?? 0), 0)
    : null;

  // Possible range: lock actuals; pending free in [0, max]
  let possibleRange: { min: number; max: number } | null = null;
  if (schemeComplete || totalWeight > 0) {
    let min = 0;
    let max = 0;
    for (const c of contributions) {
      if (c.effectiveWeight === 0) continue;
      if (c.actualScore != null && lockActuals && !allowActualOverride) {
        const pts = ((c.normalizedActual ?? 0) * c.effectiveWeight) / 100;
        min += pts;
        max += pts;
      } else {
        max += (NORMALIZED_SCALE * c.effectiveWeight) / 100;
        // min stays +0 for free pending
      }
    }
    possibleRange = { min, max };
  }

  const pass =
    projectedOverall != null
      ? evaluatePass(scheme, contributions, projectedOverall)
      : null;

  return {
    schemeComplete,
    totalWeight,
    completedWeight,
    remainingWeight: Math.max(0, totalWeight - completedWeight),
    securedPoints,
    gradedWorkAverage,
    projectedOverall,
    possibleRange,
    contributions,
    pass,
  };
}

/**
 * Minimum score needed on `targetId` (on that assessment's scale) to meet
 * `targetOverall` (normalized 0–100), given other scenario scores.
 */
export function requiredScoreForTarget(
  scheme: GradeSchemeInput,
  targetId: string,
  targetOverall: number,
  scenario: GradeScenarioScores = {},
  options?: { lockActuals?: boolean; allowActualOverride?: boolean },
): RequiredScoreResult {
  const target = scheme.components.find((c) => c.id === targetId);
  if (!target) {
    return { status: "insufficient", required: null, reason: "Assessment not found." };
  }
  const w = effectiveWeight(target, scheme.groups);
  if (w <= 0) {
    return {
      status: "insufficient",
      reason: "This assessment has zero weight.",
      required: null,
    };
  }

  // Build scenario with target cleared so we can solve for it.
  const baseScenario: GradeScenarioScores = { ...scenario, [targetId]: null };
  const summary = summarizeGrades(scheme, baseScenario, {
    lockActuals: options?.lockActuals ?? true,
    allowActualOverride: options?.allowActualOverride ?? false,
  });

  const othersKnown = summary.contributions.every(
    (c) => c.id === targetId || c.effectiveWeight === 0 || c.normalizedScenario != null,
  );
  if (!othersKnown) {
    return {
      status: "insufficient",
      required: null,
      reason: "Set hypothetical grades on the other pending assessments first.",
    };
  }

  const pointsFromOthers = summary.contributions.reduce((s, c) => {
    if (c.id === targetId) return s;
    return s + (c.weightedPoints ?? 0);
  }, 0);

  // Also need to satisfy final min / component mins when target is constrained.
  let neededNormalized = ((targetOverall - pointsFromOthers) * 100) / w;

  if (target.componentType === "final" && scheme.passingFinalMin != null) {
    neededNormalized = Math.max(neededNormalized, scheme.passingFinalMin);
  }
  if (target.minScore != null) {
    neededNormalized = Math.max(
      neededNormalized,
      normalizeScore(target.minScore, target.maxScore),
    );
  }

  // If overall pass mark is higher than targetOverall, still use targetOverall as requested.
  const requiredOnScale = denormalizeScore(neededNormalized, target.maxScore);

  if (neededNormalized <= 0) {
    // Check whether already guaranteed at score 0
    const atZero = summarizeGrades(
      scheme,
      { ...scenario, [targetId]: 0 },
      options,
    );
    if (
      atZero.projectedOverall != null &&
      atZero.projectedOverall + 1e-9 >= targetOverall &&
      (atZero.pass?.passes ?? true)
    ) {
      return {
        status: "guaranteed",
        required: null,
        projected: atZero.projectedOverall,
      };
    }
  }

  if (neededNormalized > NORMALIZED_SCALE + 1e-9) {
    return {
      status: "impossible",
      required: null,
      reason: `Even 100% on “${target.title}” cannot reach ${targetOverall}%.`,
    };
  }

  // Conservative ceiling so displayed required never undershoots.
  const required = Math.min(
    target.maxScore,
    ceilToDecimals(Math.max(0, requiredOnScale), 2),
  );

  // Verify after ceiling; bump if still short due to other constraints.
  let candidate = required;
  for (let i = 0; i < 5; i++) {
    const check = summarizeGrades(
      scheme,
      { ...scenario, [targetId]: candidate },
      options,
    );
    const overallOk =
      check.projectedOverall != null &&
      check.projectedOverall + 1e-9 >= targetOverall;
    // For "what do I need for target overall", primary check is overall.
    // Also enforce final/component mins.
    const finalOk =
      scheme.passingFinalMin == null ||
      target.componentType !== "final" ||
      normalizeScore(candidate, target.maxScore) + 1e-9 >= scheme.passingFinalMin;
    const minOk =
      target.minScore == null || candidate + 1e-9 >= target.minScore;

    if (overallOk && finalOk && minOk) {
      return {
        status: "required",
        required: candidate,
        projectedAtRequired: check.projectedOverall ?? targetOverall,
      };
    }
    candidate = Math.min(target.maxScore, ceilToDecimals(candidate + 0.01, 2));
  }

  if (candidate >= target.maxScore) {
    const atMax = summarizeGrades(
      scheme,
      { ...scenario, [targetId]: target.maxScore },
      options,
    );
    if (
      atMax.projectedOverall != null &&
      atMax.projectedOverall + 1e-9 >= targetOverall
    ) {
      return {
        status: "required",
        required: target.maxScore,
        projectedAtRequired: atMax.projectedOverall,
      };
    }
    return {
      status: "impossible",
      required: null,
      reason: `Cannot reach ${targetOverall}% given the other grades and constraints.`,
    };
  }

  return {
    status: "required",
    required: candidate,
    projectedAtRequired: targetOverall,
  };
}

/**
 * Cross-subject aggregation: only average subjects that share the same
 * displayScaleMax and have at least one graded component. Documented method:
 * unweighted mean of each subject's graded-work average (not a credit-hour GPA).
 */
export function aggregateComparableGradedAverages(
  subjects: { displayScaleMax: number; gradedWorkAverage: number | null }[],
): { average: number | null; comparable: boolean; reason: string } {
  const graded = subjects.filter((s) => s.gradedWorkAverage != null);
  if (!graded.length) {
    return {
      average: null,
      comparable: false,
      reason: "No graded assessments yet.",
    };
  }
  const scales = new Set(graded.map((s) => s.displayScaleMax));
  if (scales.size > 1) {
    return {
      average: null,
      comparable: false,
      reason:
        "Subjects use different grade scales, so a cross-subject average is not shown.",
    };
  }
  const average =
    graded.reduce((s, x) => s + (x.gradedWorkAverage ?? 0), 0) / graded.length;
  return {
    average,
    comparable: true,
    reason: "Unweighted mean of each subject's graded-work average (same scale).",
  };
}
