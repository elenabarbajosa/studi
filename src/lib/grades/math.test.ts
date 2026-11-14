import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateComparableGradedAverages,
  ceilToDecimals,
  normalizeScore,
  requiredScoreForTarget,
  summarizeGrades,
  validateSchemeShape,
} from "@/lib/grades/math";
import type { GradeSchemeInput } from "@/lib/grades/types";

const M1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const M2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MAPLE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FINAL = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/** Spec §8 Algebra regression fixture. */
function algebraScheme(overrides?: Partial<GradeSchemeInput>): GradeSchemeInput {
  return {
    displayScaleMax: 100,
    passingOverall: 50,
    passingFinalMin: 50,
    groups: [],
    components: [
      {
        id: M1,
        title: "Midterm 1",
        componentType: "midterm",
        weightPercent: 10,
        maxScore: 100,
        score: 80,
        minScore: null,
        groupId: null,
        weightWithinGroup: null,
        sortOrder: 0,
        assessmentId: null,
        dueAt: null,
      },
      {
        id: M2,
        title: "Midterm 2",
        componentType: "midterm",
        weightPercent: 20,
        maxScore: 100,
        score: 25,
        minScore: null,
        groupId: null,
        weightWithinGroup: null,
        sortOrder: 1,
        assessmentId: null,
        dueAt: null,
      },
      {
        id: MAPLE,
        title: "Maple",
        componentType: "assignment",
        weightPercent: 10,
        maxScore: 100,
        score: null,
        minScore: null,
        groupId: null,
        weightWithinGroup: null,
        sortOrder: 2,
        assessmentId: null,
        dueAt: null,
      },
      {
        id: FINAL,
        title: "Final",
        componentType: "final",
        weightPercent: 60,
        maxScore: 100,
        score: null,
        minScore: null,
        groupId: null,
        weightWithinGroup: null,
        sortOrder: 3,
        assessmentId: null,
        dueAt: null,
      },
    ],
    ...overrides,
  };
}

describe("Algebra regression (§8)", () => {
  it("computes secured points, completed weight, and graded-work average", () => {
    const summary = summarizeGrades(algebraScheme());
    assert.equal(summary.securedPoints, 13);
    assert.equal(summary.completedWeight, 30);
    assert.ok(summary.gradedWorkAverage != null);
    assert.ok(Math.abs(summary.gradedWorkAverage! - 43.3333333333) < 1e-6);
    assert.equal(summary.projectedOverall, null);
  });

  it("requires Maple = 70% when Final = 50% to pass at 50%", () => {
    const result = requiredScoreForTarget(algebraScheme(), MAPLE, 50, {
      [FINAL]: 50,
    });
    assert.equal(result.status, "required");
    if (result.status === "required") {
      assert.equal(result.required, 70);
    }
  });

  it("passes when Maple = 70 and Final = 50", () => {
    const summary = summarizeGrades(algebraScheme(), {
      [MAPLE]: 70,
      [FINAL]: 50,
    });
    assert.ok(summary.projectedOverall != null);
    assert.ok(Math.abs(summary.projectedOverall! - 50) < 1e-9);
    assert.equal(summary.pass?.passes, true);
    assert.equal(summary.pass?.finalMinMet, true);
    assert.equal(summary.pass?.overallMet, true);
  });

  it("requires Final ≥ 61.67% when Maple = 0%", () => {
    const result = requiredScoreForTarget(algebraScheme(), FINAL, 50, {
      [MAPLE]: 0,
    });
    assert.equal(result.status, "required");
    if (result.status === "required") {
      // 37/0.6 = 61.666... → ceil to 61.67
      assert.equal(result.required, 61.67);
      const check = summarizeGrades(algebraScheme(), {
        [MAPLE]: 0,
        [FINAL]: result.required,
      });
      assert.ok((check.projectedOverall ?? 0) + 1e-9 >= 50);
      assert.equal(check.pass?.passes, true);
    }
  });

  it("does not pass when Final = 49% even if overall could exceed 50%", () => {
    // Maple 100 → 13 + 10 + 49*0.6 = 13+10+29.4 = 52.4 > 50 overall, but final min fails
    const summary = summarizeGrades(algebraScheme(), {
      [MAPLE]: 100,
      [FINAL]: 49,
    });
    assert.ok((summary.projectedOverall ?? 0) > 50);
    assert.equal(summary.pass?.passes, false);
    assert.equal(summary.pass?.finalMinMet, false);
  });

  it("never mutates actual scores when applying a scenario", () => {
    const scheme = algebraScheme();
    const before = scheme.components.map((c) => c.score);
    summarizeGrades(scheme, { [MAPLE]: 90, [FINAL]: 80 });
    assert.deepEqual(
      scheme.components.map((c) => c.score),
      before,
    );
  });
});

describe("grade scales and edge cases", () => {
  it("normalizes 0–10 scores onto the internal 0–100 scale", () => {
    assert.equal(normalizeScore(7, 10), 70);
    const scheme: GradeSchemeInput = {
      displayScaleMax: 10,
      passingOverall: 50,
      passingFinalMin: null,
      groups: [],
      components: [
        {
          id: M1,
          title: "Quiz",
          componentType: "quiz",
          weightPercent: 100,
          maxScore: 10,
          score: 7,
          minScore: null,
          groupId: null,
          weightWithinGroup: null,
          sortOrder: 0,
          assessmentId: null,
          dueAt: null,
        },
      ],
    };
    const summary = summarizeGrades(scheme);
    assert.equal(summary.gradedWorkAverage, 70);
    assert.equal(summary.securedPoints, 70);
  });

  it("ignores zero-weight assessments in averages", () => {
    const scheme = algebraScheme({
      components: [
        {
          id: M1,
          title: "Practice",
          componentType: "other",
          weightPercent: 0,
          maxScore: 100,
          score: 100,
          minScore: null,
          groupId: null,
          weightWithinGroup: null,
          sortOrder: 0,
          assessmentId: null,
          dueAt: null,
        },
        {
          id: M2,
          title: "Exam",
          componentType: "final",
          weightPercent: 100,
          maxScore: 100,
          score: 40,
          minScore: null,
          groupId: null,
          weightWithinGroup: null,
          sortOrder: 1,
          assessmentId: null,
          dueAt: null,
        },
      ],
    });
    const summary = summarizeGrades(scheme);
    assert.equal(summary.gradedWorkAverage, 40);
    assert.equal(summary.securedPoints, 40);
  });

  it("flags incomplete schemes and duplicate links", () => {
    const scheme = algebraScheme({
      components: algebraScheme().components.map((c, i) =>
        i === 0
          ? { ...c, weightPercent: 5, assessmentId: "link-1" }
          : i === 1
            ? { ...c, assessmentId: "link-1" }
            : c,
      ),
    });
    const errors = validateSchemeShape(scheme);
    assert.ok(errors.some((e) => /linked more than once/i.test(e)));
    const summary = summarizeGrades(scheme);
    assert.equal(summary.schemeComplete, false);
  });

  it("ceilToDecimals never undershoots the true required score", () => {
    assert.equal(ceilToDecimals(61.666666, 2), 61.67);
    assert.equal(ceilToDecimals(70, 2), 70);
  });

  it("reports impossible targets honestly", () => {
    const result = requiredScoreForTarget(algebraScheme(), MAPLE, 95, {
      [FINAL]: 50,
    });
    // 13 + 0.1M + 30 = 95 → 0.1M = 52 → impossible
    assert.equal(result.status, "impossible");
  });

  it("does not treat missing grades as zero in graded-work average", () => {
    const summary = summarizeGrades(algebraScheme());
    // If zeros were assumed for Maple+Final, average would be 13 — not 43.33
    assert.notEqual(summary.gradedWorkAverage, 13);
    assert.ok((summary.gradedWorkAverage ?? 0) > 40);
  });
});

describe("aggregateComparableGradedAverages", () => {
  it("averages same-scale subjects only", () => {
    const ok = aggregateComparableGradedAverages([
      { displayScaleMax: 100, gradedWorkAverage: 80 },
      { displayScaleMax: 100, gradedWorkAverage: 60 },
    ]);
    assert.equal(ok.comparable, true);
    assert.equal(ok.average, 70);

    const mixed = aggregateComparableGradedAverages([
      { displayScaleMax: 100, gradedWorkAverage: 80 },
      { displayScaleMax: 10, gradedWorkAverage: 8 },
    ]);
    assert.equal(mixed.comparable, false);
    assert.equal(mixed.average, null);
  });
});
