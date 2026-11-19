import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEventRange } from "@/lib/calendar";
import {
  END_BEFORE_START_MESSAGE,
  endAfterStartError,
  friendlyWriteError,
  isPastCalendarEvent,
  resolveTimeZone,
  shiftEndPreservingDuration,
} from "@/lib/event-time";
import { localDateKey } from "@/lib/progress/timezone";
import { utcIsoToLocalTime } from "@/lib/planner/zoned-time";
import { dueAtFromForm, scheduleRangeFromForm } from "@/lib/task-due";
import {
  assessmentSchema,
  eventMoveSchema,
  personalEventSchema,
  studySessionSchema,
} from "@/lib/validations/phase3";

function wall(iso: string, timeZone: string) {
  return `${localDateKey(iso, timeZone)} ${utcIsoToLocalTime(iso, timeZone)}`;
}

describe("buildEventRange timezones", () => {
  it("stores 14:00–15:30 as that wall clock in Europe/Madrid winter (UTC+1)", () => {
    const range = buildEventRange({
      date: "2026-01-15",
      startTime: "14:00",
      endTime: "15:30",
      allDay: false,
      timeZone: "Europe/Madrid",
    });
    assert.equal(range.starts_at, "2026-01-15T13:00:00.000Z");
    assert.equal(range.ends_at, "2026-01-15T14:30:00.000Z");
    assert.equal(wall(range.starts_at, "Europe/Madrid"), "2026-01-15 14:00");
    assert.equal(wall(range.ends_at, "Europe/Madrid"), "2026-01-15 15:30");
  });

  it("stores Madrid summer time as UTC+2", () => {
    const range = buildEventRange({
      date: "2026-07-15",
      startTime: "14:00",
      endTime: "15:30",
      allDay: false,
      timeZone: "Europe/Madrid",
    });
    assert.equal(range.starts_at, "2026-07-15T12:00:00.000Z");
    assert.equal(range.ends_at, "2026-07-15T13:30:00.000Z");
  });

  it("keeps Atlantic/Canary winter on UTC and summer on UTC+1", () => {
    const winter = buildEventRange({
      date: "2026-01-15",
      startTime: "14:00",
      endTime: "15:00",
      allDay: false,
      timeZone: "Atlantic/Canary",
    });
    const summer = buildEventRange({
      date: "2026-07-15",
      startTime: "14:00",
      endTime: "15:00",
      allDay: false,
      timeZone: "Atlantic/Canary",
    });
    assert.equal(winter.starts_at, "2026-01-15T14:00:00.000Z");
    assert.equal(summer.starts_at, "2026-07-15T13:00:00.000Z");
    assert.equal(wall(summer.starts_at, "Atlantic/Canary"), "2026-07-15 14:00");
  });

  it("stores UTC wall times unchanged", () => {
    const range = buildEventRange({
      date: "2026-01-15",
      startTime: "14:00",
      endTime: "15:30",
      allDay: false,
      timeZone: "UTC",
    });
    assert.equal(range.starts_at, "2026-01-15T14:00:00.000Z");
    assert.equal(range.ends_at, "2026-01-15T15:30:00.000Z");
  });

  it("handles the Europe/Madrid spring-forward and fall-back Sundays of 2026", () => {
    // 2026-03-29: clocks jump 02:00 → 03:00. 01:30 and 03:30 exist.
    const before = buildEventRange({
      date: "2026-03-29",
      startTime: "01:30",
      endTime: "03:30",
      allDay: false,
      timeZone: "Europe/Madrid",
    });
    assert.equal(before.starts_at, "2026-03-29T00:30:00.000Z");
    assert.equal(before.ends_at, "2026-03-29T01:30:00.000Z");
    assert.equal(wall(before.starts_at, "Europe/Madrid"), "2026-03-29 01:30");
    assert.equal(wall(before.ends_at, "Europe/Madrid"), "2026-03-29 03:30");

    // 02:30 does not exist; the next valid local time is 03:00.
    const gap = buildEventRange({
      date: "2026-03-29",
      startTime: "02:30",
      endTime: "04:00",
      allDay: false,
      timeZone: "Europe/Madrid",
    });
    assert.equal(wall(gap.starts_at, "Europe/Madrid"), "2026-03-29 03:00");

    // 2026-10-25: 02:30 happens twice. The earlier occurrence (still CEST) is kept.
    const overlap = buildEventRange({
      date: "2026-10-25",
      startTime: "02:30",
      endTime: "03:30",
      allDay: false,
      timeZone: "Europe/Madrid",
    });
    assert.equal(overlap.starts_at, "2026-10-25T00:30:00.000Z");
    assert.equal(wall(overlap.starts_at, "Europe/Madrid"), "2026-10-25 02:30");
    assert.equal(wall(overlap.ends_at, "Europe/Madrid"), "2026-10-25 03:30");
  });

  it("handles the Atlantic/Canary DST Sundays of 2026", () => {
    // Spring forward is 01:00 → 02:00. 00:30 and 02:30 exist.
    const spring = buildEventRange({
      date: "2026-03-29",
      startTime: "00:30",
      endTime: "02:30",
      allDay: false,
      timeZone: "Atlantic/Canary",
    });
    assert.equal(spring.starts_at, "2026-03-29T00:30:00.000Z");
    assert.equal(spring.ends_at, "2026-03-29T01:30:00.000Z");

    const gap = buildEventRange({
      date: "2026-03-29",
      startTime: "01:30",
      endTime: "02:30",
      allDay: false,
      timeZone: "Atlantic/Canary",
    });
    assert.equal(wall(gap.starts_at, "Atlantic/Canary"), "2026-03-29 02:00");

    // Fall back: 01:30 happens twice. Keep the earlier (WEST, UTC+1) occurrence.
    const fall = buildEventRange({
      date: "2026-10-25",
      startTime: "01:30",
      endTime: "02:30",
      allDay: false,
      timeZone: "Atlantic/Canary",
    });
    assert.equal(fall.starts_at, "2026-10-25T00:30:00.000Z");
    assert.equal(wall(fall.starts_at, "Atlantic/Canary"), "2026-10-25 01:30");
  });

  it("keeps an all-day syllabus date on that local calendar day", () => {
    const range = buildEventRange({
      date: "2026-11-20",
      allDay: true,
      timeZone: "Europe/Madrid",
    });
    assert.equal(range.all_day, true);
    assert.equal(localDateKey(range.starts_at, "Europe/Madrid"), "2026-11-20");
    assert.equal(localDateKey(range.ends_at, "Europe/Madrid"), "2026-11-20");
    assert.equal(range.starts_at, "2026-11-19T23:00:00.000Z");
  });
});

describe("deadlines and study blocks", () => {
  it("stores a timed due instant in the user's timezone", () => {
    assert.equal(
      dueAtFromForm("2026-01-15", "14:00", "Europe/Madrid"),
      "2026-01-15T13:00:00.000Z",
    );
    assert.equal(
      dueAtFromForm("2026-01-15", "14:00", "Atlantic/Canary"),
      "2026-01-15T14:00:00.000Z",
    );
    assert.equal(dueAtFromForm("2026-11-14", "09:30", "UTC"), "2026-11-14T09:30:00.000Z");
    assert.equal(dueAtFromForm("2026-11-14"), "2026-11-14T12:00:00.000Z");
  });

  it("stores a scheduled study block in the user's timezone", () => {
    const range = scheduleRangeFromForm("2026-07-15", "14:00", "15:30", "Europe/Madrid");
    assert.equal(range.scheduled_start, "2026-07-15T12:00:00.000Z");
    assert.equal(range.scheduled_end, "2026-07-15T13:30:00.000Z");
  });
});

describe("event form validation", () => {
  it("rejects an end that is not after the start", () => {
    assert.equal(endAfterStartError("14:00", "13:00", false), END_BEFORE_START_MESSAGE);
    assert.equal(endAfterStartError("14:00", "14:00", true), END_BEFORE_START_MESSAGE);
    assert.equal(endAfterStartError("14:00", "15:30", false), null);
  });

  it("shifts the end to keep duration until the user sets the end", () => {
    assert.equal(shiftEndPreservingDuration("14:00", "15:00", "15:30"), "16:30");
    assert.equal(shiftEndPreservingDuration("22:00", "23:00", "23:30"), "23:59");
    assert.equal(shiftEndPreservingDuration("10:00", "09:00", "11:00"), "10:00");
  });

  it("warns for a past start without treating it as an error", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    assert.equal(
      isPastCalendarEvent({
        date: "2026-06-15",
        startTime: "10:00",
        allDay: false,
        timeZone: "Europe/Madrid",
        now,
      }),
      true,
    );
    assert.equal(
      isPastCalendarEvent({
        date: "2026-06-16",
        startTime: "10:00",
        allDay: false,
        timeZone: "Europe/Madrid",
        now,
      }),
      false,
    );
    assert.equal(
      isPastCalendarEvent({
        date: "2026-06-14",
        allDay: true,
        timeZone: "Atlantic/Canary",
        now,
      }),
      true,
    );
    assert.equal(endAfterStartError("10:00", "11:00", false), null);
  });

  it("rejects inverted times in the server schemas and hides raw constraint text", () => {
    const personal = personalEventSchema.safeParse({
      title: "Lab",
      date: "2026-06-15",
      start_time: "15:00",
      end_time: "14:00",
      all_day: false,
    });
    assert.equal(personal.success, false);
    assert.equal(personal.error?.issues[0]?.message, END_BEFORE_START_MESSAGE);

    const session = studySessionSchema.safeParse({
      date: "2026-06-15",
      start_time: "15:00",
      end_time: "15:00",
    });
    assert.equal(session.success, false);

    const assessment = assessmentSchema.safeParse({
      title: "Midterm",
      assessment_type: "midterm",
      date: "2026-06-15",
      start_time: "09:00",
      end_time: "08:00",
      all_day: false,
      priority: "medium",
    });
    assert.equal(assessment.success, false);

    const allDay = assessmentSchema.safeParse({
      title: "Essay",
      assessment_type: "assignment",
      date: "2026-06-15",
      all_day: true,
      priority: "medium",
    });
    assert.equal(allDay.success, true);

    const move = eventMoveSchema.safeParse({
      starts_at: "2026-06-15T15:00:00.000Z",
      ends_at: "2026-06-15T14:00:00.000Z",
    });
    assert.equal(move.success, false);

    assert.equal(
      friendlyWriteError(
        'new row for relation "calendar_events" violates check constraint "calendar_events_ends_after_start"',
      ),
      END_BEFORE_START_MESSAGE,
    );
    assert.equal(friendlyWriteError("connection reset"), "Couldn't save this. Please try again.");
  });

  it("prefers a valid browser timezone over the profile fallback", () => {
    assert.equal(resolveTimeZone("Europe/Madrid", "UTC"), "Europe/Madrid");
    assert.equal(resolveTimeZone("Not/AZone", "Atlantic/Canary"), "Atlantic/Canary");
    assert.equal(resolveTimeZone("", "UTC"), "UTC");
  });
});
