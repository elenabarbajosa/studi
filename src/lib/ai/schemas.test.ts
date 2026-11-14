import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  importSyllabusPayloadSchema,
  syllabusExtractionSchema,
} from "@/lib/ai/schemas";

describe("syllabusExtractionSchema", () => {
  it("accepts a valid hierarchical extraction", () => {
    const parsed = syllabusExtractionSchema.parse({
      language: "en",
      topics: [
        {
          title: "Limits",
          order: 0,
          estimatedDifficulty: "medium",
          sourcePage: 2,
          subtopics: [{ title: "Epsilon-delta", order: 0 }],
        },
      ],
      assessments: [
        {
          title: "Midterm",
          type: "midterm",
          date: "2026-11-20",
          dateAmbiguous: false,
          weightPercent: 30,
        },
      ],
      suggestions: [],
      warnings: [],
    });

    assert.equal(parsed.topics[0]?.title, "Limits");
    assert.equal(parsed.topics[0]?.subtopics[0]?.title, "Epsilon-delta");
    assert.equal(parsed.assessments[0]?.weightPercent, 30);
  });

  it("rejects invalid Gemini assessment dates that are not ISO or null", () => {
    const result = syllabusExtractionSchema.safeParse({
      topics: [],
      assessments: [
        {
          title: "Final",
          type: "final",
          date: "next Friday",
          dateAmbiguous: true,
        },
      ],
      suggestions: [],
      warnings: [],
    });
    assert.equal(result.success, false);
  });

  it("keeps missing dates as null and preserves ambiguity", () => {
    const parsed = syllabusExtractionSchema.parse({
      topics: [],
      assessments: [
        {
          title: "Quiz 1",
          type: "quiz",
          date: null,
          dateAmbiguous: true,
          dateRaw: "Week 4",
        },
      ],
      suggestions: [],
      warnings: ["Quiz 1 date needs confirmation"],
    });
    assert.equal(parsed.assessments[0]?.date, null);
    assert.equal(parsed.assessments[0]?.dateAmbiguous, true);
    assert.equal(parsed.warnings.length, 1);
  });
});

describe("importSyllabusPayloadSchema", () => {
  it("requires confirmed ISO dates for selected assessments", () => {
    const bad = importSyllabusPayloadSchema.safeParse({
      sessionId: "not-a-uuid",
      topics: [],
      assessments: [
        {
          localId: "a1",
          title: "Final",
          assessment_type: "final",
          date: "2026-12-01",
          selected: true,
        },
      ],
    });
    assert.equal(bad.success, false);

    const good = importSyllabusPayloadSchema.safeParse({
      sessionId: "11111111-1111-4111-8111-111111111111",
      topics: [
        {
          localId: "t1",
          title: "Derivatives",
          selected: true,
          subtopics: [{ localId: "s1", title: "Chain rule", selected: true }],
        },
      ],
      assessments: [
        {
          localId: "a1",
          title: "Final",
          assessment_type: "final",
          date: "2026-12-01",
          selected: true,
        },
      ],
    });
    assert.equal(good.success, true);
  });
});
