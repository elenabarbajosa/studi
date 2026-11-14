import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { saveGradeSchemeSchema } from "@/lib/grades/schemas";

describe("saveGradeSchemeSchema", () => {
  it("rejects duplicate assessment links", () => {
    const result = saveGradeSchemeSchema.safeParse({
      subjectId: "11111111-1111-4111-8111-111111111111",
      displayScaleMax: 100,
      passingOverall: 50,
      passingFinalMin: null,
      groups: [],
      components: [
        {
          clientKey: "a",
          title: "Midterm",
          componentType: "midterm",
          weightPercent: 40,
          maxScore: 100,
          sortOrder: 0,
          assessmentId: "22222222-2222-4222-8222-222222222222",
        },
        {
          clientKey: "b",
          title: "Copy",
          componentType: "other",
          weightPercent: 60,
          maxScore: 100,
          sortOrder: 1,
          assessmentId: "22222222-2222-4222-8222-222222222222",
        },
      ],
    });
    assert.equal(result.success, false);
  });

  it("accepts a valid complete scheme draft", () => {
    const result = saveGradeSchemeSchema.safeParse({
      subjectId: "11111111-1111-4111-8111-111111111111",
      displayScaleMax: 100,
      passingOverall: 50,
      passingFinalMin: 50,
      groups: [],
      components: [
        {
          clientKey: "a",
          title: "Midterm",
          componentType: "midterm",
          weightPercent: 40,
          maxScore: 100,
          score: 80,
          sortOrder: 0,
        },
        {
          clientKey: "b",
          title: "Final",
          componentType: "final",
          weightPercent: 60,
          maxScore: 100,
          sortOrder: 1,
        },
      ],
    });
    assert.equal(result.success, true);
  });
});
