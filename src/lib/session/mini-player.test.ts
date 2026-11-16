import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  focusPhaseStatusLabel,
  isFocusFullRoute,
  isStudyTogetherRoomRoute,
  shouldShowFocusMiniPlayer,
  shouldShowStudyTogetherMiniPlayer,
} from "@/lib/session/mini-player";

describe("session mini-player visibility", () => {
  it("hides Focus mini-player on the Focus route", () => {
    assert.equal(isFocusFullRoute("/focus"), true);
    assert.equal(isFocusFullRoute("/focus/"), true);
    assert.equal(isFocusFullRoute("/dashboard"), false);
    assert.equal(shouldShowFocusMiniPlayer("/focus", "running"), false);
    assert.equal(shouldShowFocusMiniPlayer("/subjects", "running"), true);
    assert.equal(shouldShowFocusMiniPlayer("/subjects", "paused"), true);
    assert.equal(shouldShowFocusMiniPlayer("/subjects", "finished"), true);
    assert.equal(shouldShowFocusMiniPlayer("/subjects", "idle"), false);
  });

  it("hides Study Together mini-player on the matching room route only", () => {
    const roomId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    assert.equal(
      isStudyTogetherRoomRoute(`/study-together/${roomId}`, roomId),
      true,
    );
    assert.equal(
      shouldShowStudyTogetherMiniPlayer(`/study-together/${roomId}`, roomId),
      false,
    );
    assert.equal(
      shouldShowStudyTogetherMiniPlayer("/study-together", roomId),
      true,
    );
    assert.equal(
      shouldShowStudyTogetherMiniPlayer("/dashboard", roomId),
      true,
    );
    assert.equal(
      shouldShowStudyTogetherMiniPlayer("/calendar", roomId),
      true,
    );
    assert.equal(
      shouldShowStudyTogetherMiniPlayer("/subjects", roomId),
      true,
    );
    assert.equal(shouldShowStudyTogetherMiniPlayer("/calendar", null), false);
  });

  it("labels Focus phase status clearly", () => {
    assert.equal(
      focusPhaseStatusLabel({ runState: "paused", phase: "focus" }),
      "Paused",
    );
    assert.equal(
      focusPhaseStatusLabel({ runState: "running", phase: "short_break" }),
      "Short break",
    );
    assert.equal(
      focusPhaseStatusLabel({ runState: "finished", phase: "focus" }),
      "Finished",
    );
    assert.equal(
      focusPhaseStatusLabel({ runState: "running", phase: "focus" }),
      "Focusing",
    );
  });
});
