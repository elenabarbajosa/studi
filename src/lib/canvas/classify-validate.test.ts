import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateClassifications } from "@/lib/canvas/classify-validate";
import { fingerprintForItem } from "@/lib/canvas/storage";

const TOPIC_A = "11111111-1111-4111-8111-111111111111";
const TOPIC_B = "22222222-2222-4222-8222-222222222222";
const FAKE = "99999999-9999-4999-8999-999999999999";

describe("validateClassifications", () => {
  it("keeps valid topic IDs and drops invented ones", () => {
    const result = validateClassifications(
      {
        classifications: [
          {
            localId: "a",
            topicId: TOPIC_A,
            confidence: "high",
            explanation: "Matches Module 1",
          },
          {
            localId: "b",
            topicId: FAKE,
            confidence: "high",
            explanation: "Invented",
          },
          {
            localId: "c",
            topicId: null,
            confidence: "none",
            explanation: "Unsure",
          },
        ],
      },
      new Set([TOPIC_A, TOPIC_B]),
      ["a", "b", "c", "d"],
    );

    assert.equal(result.find((r) => r.localId === "a")?.topicId, TOPIC_A);
    assert.equal(result.find((r) => r.localId === "b")?.topicId, null);
    assert.equal(result.find((r) => r.localId === "b")?.confidence, "none");
    assert.equal(result.find((r) => r.localId === "d")?.confidence, "none");
  });

  it("rejects malformed AI payloads", () => {
    assert.throws(() => validateClassifications({ nope: true }, new Set(), ["a"]));
  });
});

describe("fingerprintForItem", () => {
  it("is stable for the same archive path", () => {
    const a = fingerprintForItem({
      archivePath: "Module/a.pdf",
      externalUrl: null,
      localId: "x",
    });
    const b = fingerprintForItem({
      archivePath: "Module/a.pdf",
      externalUrl: null,
      localId: "different",
    });
    assert.equal(a, b);
  });

  it("differs for different URLs", () => {
    const a = fingerprintForItem({
      archivePath: null,
      externalUrl: "https://a.example",
      localId: "1",
    });
    const b = fingerprintForItem({
      archivePath: null,
      externalUrl: "https://b.example",
      localId: "1",
    });
    assert.notEqual(a, b);
  });
});
