import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countSelectedImport,
  extractionToReviewDraft,
  parseSyllabusExtraction,
  planImportInserts,
  resetLocalIdCounter,
  reviewDraftToImportPayload,
  safeParseSyllabusExtraction,
} from "@/lib/ai/import-plan";

const SAMPLE_SYLLABUS_EXTRACTION = {
  language: "en",
  topics: [
    {
      title: "Limits and Continuity",
      order: 0,
      estimatedDifficulty: "medium",
      sourcePage: 1,
      subtopics: [
        { title: "One-sided limits", order: 0, estimatedDifficulty: "easy" },
        { title: "Continuity", order: 1, estimatedDifficulty: "medium" },
      ],
    },
    {
      title: "Derivatives",
      order: 1,
      estimatedDifficulty: "hard",
      subtopics: [{ title: "Chain rule", order: 0 }],
    },
  ],
  assessments: [
    {
      title: "Midterm Exam",
      type: "midterm",
      date: "2026-11-20",
      dateAmbiguous: false,
      weightPercent: 30,
      sourcePage: 3,
    },
    {
      title: "Quiz 2",
      type: "quiz",
      date: null,
      dateAmbiguous: true,
      dateRaw: "Week 6",
    },
  ],
  suggestions: [],
  warnings: ["Quiz 2 date needs confirmation"],
};

describe("hierarchical topic import planning", () => {
  it("builds a review draft from a sample syllabus extraction", () => {
    resetLocalIdCounter();
    const extraction = parseSyllabusExtraction(SAMPLE_SYLLABUS_EXTRACTION);
    const draft = extractionToReviewDraft(extraction, ["Derivatives"]);

    assert.equal(draft.topics.length, 2);
    assert.equal(draft.topics[0]?.subtopics.length, 2);
    assert.equal(draft.topics[1]?.possibleDuplicate, true);
    assert.equal(draft.topics[1]?.selected, false);
    assert.equal(draft.assessments[1]?.needsConfirmation, true);
    assert.equal(draft.assessments[1]?.selected, false);
    assert.ok(draft.suggestions.some((s) => s.kind === "duplicate_topic"));
  });

  it("plans inserts while skipping duplicates and undated assessments", () => {
    resetLocalIdCounter();
    const extraction = parseSyllabusExtraction(SAMPLE_SYLLABUS_EXTRACTION);
    const draft = extractionToReviewDraft(extraction, ["Derivatives"]);
    // User re-selects the duplicate anyway — import must still skip it.
    draft.topics = draft.topics.map((t) =>
      t.title === "Derivatives" ? { ...t, selected: true } : t,
    );
    // User confirms the ambiguous quiz date
    draft.assessments = draft.assessments.map((a) =>
      a.title === "Quiz 2"
        ? { ...a, date: "2026-12-05", dateAmbiguous: false, selected: true, needsConfirmation: false }
        : a,
    );

    const payload = reviewDraftToImportPayload("11111111-1111-4111-8111-111111111111", draft);
    payload.assessments = draft.assessments
      .filter((a) => a.selected && a.date)
      .map((a) => ({
        localId: a.localId,
        title: a.title,
        assessment_type: a.type === "midterm" || a.type === "quiz" ? a.type : "other",
        date: a.date as string,
        weightPercent: a.weightPercent,
        notes: a.notes,
        selected: true,
      }));

    const plan = planImportInserts(payload, ["Derivatives"]);
    assert.equal(plan.topics.length, 1);
    assert.equal(plan.topics[0]?.title, "Limits and Continuity");
    assert.equal(plan.topics[0]?.subtopics.length, 2);
    assert.deepEqual(plan.skippedDuplicates, ["Derivatives"]);
    assert.equal(plan.assessments.length, 2);
    assert.ok(plan.assessments[0]?.description?.includes("Weight: 30%"));
  });

  it("counts selected import items", () => {
    const counts = countSelectedImport({
      sessionId: "11111111-1111-4111-8111-111111111111",
      topics: [
        {
          localId: "t1",
          title: "A",
          selected: true,
          subtopics: [
            { localId: "s1", title: "A1", selected: true },
            { localId: "s2", title: "A2", selected: false },
          ],
        },
        { localId: "t2", title: "B", selected: false, subtopics: [] },
      ],
      assessments: [
        {
          localId: "e1",
          title: "Final",
          assessment_type: "final",
          date: "2026-12-01",
          selected: true,
        },
      ],
    });
    assert.deepEqual(counts, { topics: 1, subtopics: 1, assessments: 1 });
  });
});

describe("invalid Gemini responses", () => {
  it("rejects completely invalid payloads", () => {
    const result = safeParseSyllabusExtraction({ topics: "nope" });
    assert.equal(result.success, false);
  });
});
