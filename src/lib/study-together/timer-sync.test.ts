import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accruePersonalFocusMs,
  formatTimerMs,
  remainingMsFromTimer,
  shouldPreferRevision,
} from "@/lib/study-together/timer-sync";

describe("remainingMsFromTimer", () => {
  it("returns paused remaining", () => {
    const ms = remainingMsFromTimer(
      {
        phase: "focus",
        run_state: "paused",
        phase_ends_at: null,
        remaining_ms_when_paused: 780_000,
        phase_duration_ms: 1_500_000,
      },
      Date.now(),
    );
    assert.equal(ms, 780_000);
  });

  it("computes late-join remaining from phase_ends_at", () => {
    const now = Date.parse("2026-01-01T12:12:00.000Z");
    const ms = remainingMsFromTimer(
      {
        phase: "focus",
        run_state: "running",
        phase_ends_at: "2026-01-01T12:25:00.000Z",
        remaining_ms_when_paused: null,
        phase_duration_ms: 1_500_000,
      },
      now,
    );
    assert.equal(ms, 13 * 60_000);
  });

  it("rejects older revisions", () => {
    assert.equal(shouldPreferRevision(5, 4), true);
    assert.equal(shouldPreferRevision(4, 5), false);
  });
});

describe("accruePersonalFocusMs", () => {
  it("counts only personal focus during shared focus running", () => {
    assert.equal(
      accruePersonalFocusMs({
        roomPhase: "focus",
        roomRun: "running",
        personallyFocusing: true,
        connected: true,
        deltaMs: 1000,
      }),
      1000,
    );
    assert.equal(
      accruePersonalFocusMs({
        roomPhase: "short_break",
        roomRun: "running",
        personallyFocusing: true,
        connected: true,
        deltaMs: 1000,
      }),
      0,
    );
    assert.equal(
      accruePersonalFocusMs({
        roomPhase: "focus",
        roomRun: "running",
        personallyFocusing: false,
        connected: true,
        deltaMs: 1000,
      }),
      0,
    );
  });
});

describe("formatTimerMs", () => {
  it("formats mm:ss", () => {
    assert.equal(formatTimerMs(13 * 60_000), "13:00");
    assert.equal(formatTimerMs(65_000), "01:05");
  });
});
