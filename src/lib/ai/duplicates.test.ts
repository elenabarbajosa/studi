import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findDuplicateTitles, isDuplicateTitle, normalizeTopicTitle } from "@/lib/ai/duplicates";

describe("normalizeTopicTitle", () => {
  it("normalizes case, punctuation, and whitespace", () => {
    assert.equal(normalizeTopicTitle("  Epsilon–Delta  Proofs!! "), "epsilon-delta proofs");
  });
});

describe("findDuplicateTitles", () => {
  it("detects duplicates against existing topics", () => {
    const matches = findDuplicateTitles(
      ["Limits", "Integrals", "limits"],
      ["limits", "Series"],
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.existingTitle, "limits");
  });

  it("isDuplicateTitle mirrors matching", () => {
    assert.equal(isDuplicateTitle("Chain Rule", ["chain rule"]), true);
    assert.equal(isDuplicateTitle("Taylor Series", ["chain rule"]), false);
  });
});
