import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeStreaks, dailyFocusTotals } from "@/lib/progress/streaks";
import { allocateFocusToLocalDays, localDateKey } from "@/lib/progress/timezone";
import { computeWeeklyGoal } from "@/lib/progress/goals";
import {
  eligibleAchievements,
  newlyUnlocked,
} from "@/lib/progress/achievements";
import { computeChallengeProgress } from "@/lib/progress/challenges";

describe("allocateFocusToLocalDays", () => {
  it("attributes same-day sessions to one local day", () => {
    const map = allocateFocusToLocalDays({
      startsAt: "2026-03-10T15:00:00.000Z",
      endsAt: "2026-03-10T16:00:00.000Z",
      focusSeconds: 3600,
      timeZone: "UTC",
    });
    assert.equal(map.get("2026-03-10"), 3600);
  });

  it("splits across UTC midnight", () => {
    const map = allocateFocusToLocalDays({
      startsAt: "2026-03-10T23:30:00.000Z",
      endsAt: "2026-03-11T00:30:00.000Z",
      focusSeconds: 3600,
      timeZone: "UTC",
    });
    assert.equal((map.get("2026-03-10") ?? 0) + (map.get("2026-03-11") ?? 0), 3600);
    assert.ok((map.get("2026-03-10") ?? 0) > 0);
    assert.ok((map.get("2026-03-11") ?? 0) > 0);
  });
});

describe("computeStreaks", () => {
  it("counts consecutive active days and ignores incomplete today", () => {
    const sessions = [
      {
        starts_at: "2026-03-08T12:00:00.000Z",
        ends_at: "2026-03-08T12:30:00.000Z",
        focus_seconds: 1800,
        status: "completed",
        source: "focus",
      },
      {
        starts_at: "2026-03-09T12:00:00.000Z",
        ends_at: "2026-03-09T12:30:00.000Z",
        focus_seconds: 1800,
        status: "completed",
        source: "focus",
      },
      {
        starts_at: "2026-03-10T12:00:00.000Z",
        ends_at: "2026-03-10T12:30:00.000Z",
        focus_seconds: 1800,
        status: "completed",
        source: "study_together",
      },
    ];
    const result = computeStreaks(sessions, {
      timeZone: "UTC",
      minDailyFocusSeconds: 15 * 60,
      restDays: [],
      consistencyDaysPerWeek: null,
      todayKey: "2026-03-11", // no study yet today
    });
    assert.equal(result.currentStreak, 3);
    assert.equal(result.longestStreak, 3);
  });

  it("rest days preserve streak without incrementing", () => {
    const sessions = [
      {
        starts_at: "2026-03-07T12:00:00.000Z",
        ends_at: "2026-03-07T12:30:00.000Z",
        focus_seconds: 1800,
        status: "completed",
        source: "focus",
      },
      // 2026-03-08 is Sunday — rest
      {
        starts_at: "2026-03-09T12:00:00.000Z",
        ends_at: "2026-03-09T12:30:00.000Z",
        focus_seconds: 1800,
        status: "completed",
        source: "focus",
      },
    ];
    const result = computeStreaks(sessions, {
      timeZone: "UTC",
      minDailyFocusSeconds: 15 * 60,
      restDays: ["sun"],
      consistencyDaysPerWeek: null,
      todayKey: "2026-03-09",
    });
    assert.equal(result.currentStreak, 2);
  });

  it("excludes breaks and planned sources", () => {
    const totals = dailyFocusTotals(
      [
        {
          starts_at: "2026-03-10T12:00:00.000Z",
          ends_at: "2026-03-10T12:30:00.000Z",
          focus_seconds: 1800,
          status: "completed",
          source: "calendar",
        },
      ],
      "UTC",
    );
    assert.equal(totals.size, 0);
  });
});

describe("computeWeeklyGoal", () => {
  it("sums Monday-week focus seconds", () => {
    const result = computeWeeklyGoal({
      sessions: [
        {
          starts_at: "2026-03-09T12:00:00.000Z", // Monday
          ends_at: "2026-03-09T13:00:00.000Z",
          focus_seconds: 3600,
          status: "completed",
          source: "focus",
        },
      ],
      timeZone: "UTC",
      todayKey: "2026-03-11",
      weeklyGoalHours: 5,
    });
    assert.equal(result.weekStart, "2026-03-09");
    assert.equal(result.completedSeconds, 3600);
    assert.equal(result.percent, 20);
  });
});

describe("achievements", () => {
  it("returns eligible ids and filters duplicates", () => {
    const eligible = eligibleAchievements({
      completedSessions: 2,
      totalFocusSeconds: 6 * 3600,
      maxPomodoroCycles: 2,
      longestStreak: 7,
      friendCount: 1,
      studyRoomMemberships: 0,
      collabSessions: 0,
      challengesCompleted: 0,
    });
    assert.ok(eligible.includes("first_focus_session"));
    assert.ok(eligible.includes("hours_5"));
    assert.ok(eligible.includes("streak_7"));
    assert.deepEqual(
      newlyUnlocked(eligible, ["first_focus_session"]),
      eligible.filter((id) => id !== "first_focus_session"),
    );
  });
});

describe("challenge progress", () => {
  it("ignores sessions outside the window", () => {
    const result = computeChallengeProgress({
      type: "hours",
      target: 2,
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-07T23:59:59.000Z",
      timeZone: "UTC",
      sessions: [
        {
          starts_at: "2026-02-28T12:00:00.000Z",
          ends_at: "2026-02-28T14:00:00.000Z",
          focus_seconds: 7200,
          status: "completed",
          source: "focus",
        },
        {
          starts_at: "2026-03-02T12:00:00.000Z",
          ends_at: "2026-03-02T13:00:00.000Z",
          focus_seconds: 3600,
          status: "completed",
          source: "focus",
        },
      ],
    });
    assert.equal(result.current, 1);
    assert.equal(result.completed, false);
  });
});

describe("localDateKey DST", () => {
  it("uses America/New_York calendar date around spring forward", () => {
    // 2026-03-08 06:30 UTC = 01:30 EST (before DST) → still Mar 8 local
    assert.equal(
      localDateKey("2026-03-08T06:30:00.000Z", "America/New_York"),
      "2026-03-08",
    );
    // After spring forward 2026-03-08 07:30 UTC = 03:30 EDT
    assert.equal(
      localDateKey("2026-03-08T07:30:00.000Z", "America/New_York"),
      "2026-03-08",
    );
  });
});
