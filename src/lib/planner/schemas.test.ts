import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aiPlanRecommendationSchema,
  saveStudyPlanPayloadSchema,
} from "@/lib/planner/schemas";
import { buildHeuristicAllocations } from "@/lib/planner/heuristic";

describe("aiPlanRecommendationSchema", () => {
  it("rejects invalid Gemini output", () => {
    const bad = aiPlanRecommendationSchema.safeParse({
      summary: "ok",
      subjectPriorities: [{ subjectId: "not-a-uuid", priority: 10 }],
    });
    assert.equal(bad.success, false);
  });

  it("accepts grounded recommendations", () => {
    const good = aiPlanRecommendationSchema.parse({
      summary: "Focus on Calculus",
      subjectPriorities: [
        {
          subjectId: "11111111-1111-4111-8111-111111111111",
          priority: 80,
          reasoning: "Midterm in 5 days",
          suggestedMinutes: 200,
          topicIds: [],
        },
      ],
      revisionTopics: [],
      workloadWarnings: [],
      practiceNeeded: [],
    });
    assert.equal(good.subjectPriorities.length, 1);
  });
});

describe("saveStudyPlanPayloadSchema", () => {
  it("requires at least one session", () => {
    const result = saveStudyPlanPayloadSchema.safeParse({
      sessionId: "11111111-1111-4111-8111-111111111111",
      periodStart: "2026-11-16",
      periodEnd: "2026-11-22",
      intensity: "balanced",
      timezone: "UTC",
      summary: null,
      recommendations: [],
      warnings: [],
      sessions: [],
    });
    assert.equal(result.success, false);
  });
});

describe("buildHeuristicAllocations", () => {
  it("does not invent exams and prioritizes real assessments", () => {
    const { recommendation, allocations } = buildHeuristicAllocations({
      timeZone: "UTC",
      periodStart: "2026-11-16",
      periodEnd: "2026-11-30",
      intensity: "balanced",
      includeRevision: true,
      subjects: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Calculus",
          difficulty: 4,
          unmasteredTopics: [
            { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Limits", status: "studying" },
          ],
        },
      ],
      assessments: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          subjectId: "11111111-1111-4111-8111-111111111111",
          title: "Midterm",
          type: "midterm",
          startsAt: "2026-11-25T09:00:00.000Z",
          daysUntil: 9,
        },
      ],
      incompleteTasks: [],
      recentFocusMinutesBySubject: {},
    });

    assert.ok(allocations.length >= 1);
    assert.ok(recommendation.summary.toLowerCase().includes("calculus"));
    assert.equal(
      recommendation.workloadWarnings.some((w) => /no upcoming exams/i.test(w)),
      false,
    );
  });

  it("warns honestly when no exams exist", () => {
    const { recommendation } = buildHeuristicAllocations({
      timeZone: "UTC",
      periodStart: "2026-11-16",
      periodEnd: "2026-11-22",
      intensity: "light",
      includeRevision: false,
      subjects: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "History",
          difficulty: 2,
          unmasteredTopics: [
            { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "WWI", status: "not_started" },
          ],
        },
      ],
      assessments: [],
      incompleteTasks: [],
      recentFocusMinutesBySubject: {},
    });
    assert.ok(recommendation.workloadWarnings.some((w) => /no upcoming exams/i.test(w)));
  });
});
