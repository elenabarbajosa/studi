import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isHexColor,
  isSubjectColorValue,
  normalizeHexColor,
  subjectTone,
  toneFromHex,
} from "@/lib/subjects";

describe("subject custom colours", () => {
  it("accepts presets and hex", () => {
    assert.equal(isSubjectColorValue("teal"), true);
    assert.equal(isHexColor("#3E9C96"), true);
    assert.equal(isHexColor("#3e9c96"), true);
    assert.equal(isHexColor("3E9C96"), false);
    assert.equal(isSubjectColorValue("#ZZZZZZ"), false);
  });

  it("normalizes hex to uppercase with hash", () => {
    assert.equal(normalizeHexColor("3e9c96"), "#3E9C96");
    assert.equal(normalizeHexColor("#abc"), null);
  });

  it("derives accessible tint and text from custom hex", () => {
    const tone = toneFromHex("#3E9C96");
    assert.equal(tone.dot, "#3E9C96");
    assert.notEqual(tone.tint, tone.dot);
    assert.notEqual(tone.text, tone.dot);
  });

  it("preserves preset tones", () => {
    assert.equal(subjectTone("teal").dot, "#3E9C96");
    assert.equal(subjectTone("#3E9C96").dot, "#3E9C96");
  });
});
