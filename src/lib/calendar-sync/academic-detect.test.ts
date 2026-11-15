import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectAcademicCandidates } from "@/lib/calendar-sync/academic-detect";

describe("detectAcademicCandidates", () => {
  it("conservatively flags exam and assignment titles", () => {
    const suggestions = detectAcademicCandidates([
      {
        id: "1",
        title: "CS Midterm",
        description: null,
        all_day: false,
        is_cancelled: false,
      },
      {
        id: "2",
        title: "Essay deadline",
        description: "Submit on Canvas",
        all_day: true,
        is_cancelled: false,
      },
      {
        id: "3",
        title: "Coffee with Sam",
        description: null,
        all_day: false,
        is_cancelled: false,
      },
    ]);
    assert.equal(suggestions.length, 2);
    assert.equal(suggestions.find((s) => s.eventId === "1")?.kind, "exam");
    assert.equal(suggestions.find((s) => s.eventId === "2")?.kind, "assignment");
  });

  it("skips cancelled events", () => {
    const suggestions = detectAcademicCandidates([
      {
        id: "1",
        title: "Final exam",
        description: null,
        all_day: false,
        is_cancelled: true,
      },
    ]);
    assert.equal(suggestions.length, 0);
  });
});
