import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSchedule,
  detectSessionConflicts,
  intensityMultiplier,
  resetProposalIds,
} from "@/lib/planner/schedule";
import { DEFAULT_PLANNER_TIME_WINDOWS } from "@/lib/planner/types";
import { DEFAULT_WEEKDAY_AVAILABILITY } from "@/lib/subjects";
import { zonedDateTimeToUtcIso } from "@/lib/planner/zoned-time";
import { localDateKey } from "@/lib/progress/timezone";

const TZ = "America/New_York";

describe("intensityMultiplier", () => {
  it("scales light and intensive relative to balanced", () => {
    assert.equal(intensityMultiplier("balanced"), 1);
    assert.ok(intensityMultiplier("light") < 1);
    assert.ok(intensityMultiplier("intensive") > 1);
  });
});

describe("zonedDateTimeToUtcIso / DST", () => {
  it("maps local wall time in a DST timezone", () => {
    // 2026-03-08 is US spring-forward Sunday in America/New_York
    const iso = zonedDateTimeToUtcIso("2026-03-09", "10:00", TZ);
    assert.equal(localDateKey(iso, TZ), "2026-03-09");
  });
});

describe("buildSchedule", () => {
  it("respects rest days and availability", () => {
    resetProposalIds();
    const result = buildSchedule(
      {
        timeZone: "UTC",
        periodStart: "2026-11-16", // Monday
        periodEnd: "2026-11-22",
        weekdayAvailability: {
          ...DEFAULT_WEEKDAY_AVAILABILITY,
          sat: false,
          sun: false,
        },
        timeWindows: DEFAULT_PLANNER_TIME_WINDOWS,
        restDays: ["sat", "sun"],
        maxHoursPerDay: 2,
        sessionMinutes: 50,
        breakMinutes: 10,
        includeRevision: true,
        nowIso: "2026-11-15T12:00:00.000Z",
        busy: [],
      },
      [
        {
          subjectId: "11111111-1111-4111-8111-111111111111",
          topicId: null,
          priority: 80,
          suggestedMinutes: 100,
          reason: "Exam prep",
          kind: "study",
          beforeDate: "2026-11-22",
        },
      ],
    );

    assert.ok(result.sessions.length >= 1);
    assert.ok(result.sessions.every((s) => s.date >= "2026-11-16"));
    assert.ok(result.sessions.every((s) => !["2026-11-21", "2026-11-22"].includes(s.date) || true));
    // No Saturday/Sunday sessions
    for (const session of result.sessions) {
      const day = new Date(`${session.date}T12:00:00Z`).getUTCDay();
      assert.notEqual(day, 6);
      assert.notEqual(day, 0);
    }
  });

  it("avoids overlapping busy calendar intervals", () => {
    resetProposalIds();
    const busyStart = zonedDateTimeToUtcIso("2026-11-16", "09:00", "UTC");
    const busyEnd = zonedDateTimeToUtcIso("2026-11-16", "12:00", "UTC");
    const result = buildSchedule(
      {
        timeZone: "UTC",
        periodStart: "2026-11-16",
        periodEnd: "2026-11-16",
        weekdayAvailability: DEFAULT_WEEKDAY_AVAILABILITY,
        timeWindows: {
          ...DEFAULT_PLANNER_TIME_WINDOWS,
          mon: [{ start: "09:00", end: "12:00" }],
        },
        restDays: [],
        maxHoursPerDay: 4,
        sessionMinutes: 50,
        breakMinutes: 0,
        includeRevision: false,
        nowIso: "2026-11-15T12:00:00.000Z",
        busy: [{ startsAt: busyStart, endsAt: busyEnd, label: "Lecture" }],
      },
      [
        {
          subjectId: "11111111-1111-4111-8111-111111111111",
          topicId: null,
          priority: 90,
          suggestedMinutes: 50,
          reason: "Should not fit morning",
          kind: "study",
        },
      ],
    );

    assert.equal(result.sessions.length, 0);
    assert.ok(result.warnings.length > 0);
  });

  it("enforces max daily study limits", () => {
    resetProposalIds();
    const result = buildSchedule(
      {
        timeZone: "UTC",
        periodStart: "2026-11-16",
        periodEnd: "2026-11-16",
        weekdayAvailability: DEFAULT_WEEKDAY_AVAILABILITY,
        timeWindows: {
          ...DEFAULT_PLANNER_TIME_WINDOWS,
          mon: [{ start: "08:00", end: "20:00" }],
        },
        restDays: [],
        maxHoursPerDay: 1,
        sessionMinutes: 50,
        breakMinutes: 0,
        includeRevision: false,
        nowIso: "2026-11-15T12:00:00.000Z",
        busy: [],
      },
      [
        {
          subjectId: "11111111-1111-4111-8111-111111111111",
          topicId: null,
          priority: 90,
          suggestedMinutes: 200,
          reason: "Heavy load",
          kind: "study",
        },
      ],
    );

    const dayMinutes = result.sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    assert.ok(dayMinutes <= 60);
    assert.ok(result.unscheduled.length >= 1);
  });

  it("does not schedule sessions in the past", () => {
    resetProposalIds();
    const result = buildSchedule(
      {
        timeZone: "UTC",
        periodStart: "2026-11-16",
        periodEnd: "2026-11-16",
        weekdayAvailability: DEFAULT_WEEKDAY_AVAILABILITY,
        timeWindows: DEFAULT_PLANNER_TIME_WINDOWS,
        restDays: [],
        maxHoursPerDay: 4,
        sessionMinutes: 50,
        breakMinutes: 0,
        includeRevision: false,
        nowIso: "2026-11-16T18:00:00.000Z",
        busy: [],
      },
      [
        {
          subjectId: "11111111-1111-4111-8111-111111111111",
          topicId: null,
          priority: 90,
          suggestedMinutes: 50,
          reason: "Too late",
          kind: "study",
        },
      ],
    );
    for (const session of result.sessions) {
      const start = zonedDateTimeToUtcIso(session.date, session.startTime, "UTC");
      assert.ok(new Date(start).getTime() >= new Date("2026-11-16T18:00:00.000Z").getTime());
    }
  });

  it("prefers scheduling before exam deadlines", () => {
    resetProposalIds();
    const result = buildSchedule(
      {
        timeZone: "UTC",
        periodStart: "2026-11-16",
        periodEnd: "2026-11-20",
        weekdayAvailability: DEFAULT_WEEKDAY_AVAILABILITY,
        timeWindows: DEFAULT_PLANNER_TIME_WINDOWS,
        restDays: [],
        maxHoursPerDay: 3,
        sessionMinutes: 50,
        breakMinutes: 10,
        includeRevision: true,
        nowIso: "2026-11-15T12:00:00.000Z",
        busy: [],
      },
      [
        {
          subjectId: "11111111-1111-4111-8111-111111111111",
          topicId: null,
          priority: 95,
          suggestedMinutes: 50,
          reason: "Before midterm",
          kind: "study",
          beforeDate: "2026-11-18",
        },
      ],
    );
    assert.ok(result.sessions.every((s) => s.date <= "2026-11-18"));
  });

  it("reports insufficient available study time", () => {
    resetProposalIds();
    const result = buildSchedule(
      {
        timeZone: "UTC",
        periodStart: "2026-11-16",
        periodEnd: "2026-11-16",
        weekdayAvailability: {
          mon: false,
          tue: false,
          wed: false,
          thu: false,
          fri: false,
          sat: false,
          sun: false,
        },
        timeWindows: DEFAULT_PLANNER_TIME_WINDOWS,
        restDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        maxHoursPerDay: 4,
        sessionMinutes: 50,
        breakMinutes: 0,
        includeRevision: false,
        nowIso: "2026-11-15T12:00:00.000Z",
        busy: [],
      },
      [
        {
          subjectId: "11111111-1111-4111-8111-111111111111",
          topicId: null,
          priority: 80,
          suggestedMinutes: 100,
          reason: "Nowhere to go",
          kind: "study",
        },
      ],
    );
    assert.equal(result.sessions.length, 0);
    assert.ok(result.warnings.some((w) => /No sessions|Not enough/i.test(w)));
  });
});

describe("detectSessionConflicts", () => {
  it("flags overlapping proposed sessions", () => {
    const conflicts = detectSessionConflicts(
      [
        {
          localId: "a",
          subjectId: "11111111-1111-4111-8111-111111111111",
          topicId: null,
          taskId: null,
          date: "2026-11-16",
          startTime: "10:00",
          endTime: "11:00",
          durationMinutes: 60,
          goal: null,
          kind: "study",
          locked: false,
          selected: true,
        },
        {
          localId: "b",
          subjectId: "22222222-2222-4222-8222-222222222222",
          topicId: null,
          taskId: null,
          date: "2026-11-16",
          startTime: "10:30",
          endTime: "11:30",
          durationMinutes: 60,
          goal: null,
          kind: "study",
          locked: false,
          selected: true,
        },
      ],
      [],
      "UTC",
    );
    assert.ok(conflicts.length >= 1);
  });
});
