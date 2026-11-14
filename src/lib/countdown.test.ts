import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessmentCountdown,
  calendarDaysUntil,
} from "@/lib/countdown";

describe("calendarDaysUntil", () => {
  it("uses IANA timezone day boundaries", () => {
    // 2026-03-08 02:30 America/New_York is still March 7 in UTC late evening? 
    // Use a clear Madrid afternoon.
    const now = new Date("2026-11-14T15:00:00.000Z"); // 16:00 CET
    assert.equal(
      calendarDaysUntil("2026-11-14T12:00:00.000Z", "Europe/Madrid", now),
      0,
    );
    assert.equal(
      calendarDaysUntil("2026-11-15T12:00:00.000Z", "Europe/Madrid", now),
      1,
    );
  });

  it("handles US spring-forward local dates", () => {
    // 2026-03-08 07:00 UTC = 02:00 EST before spring forward? 
    // America/New_York springs forward 2026-03-08 02:00 → 03:00.
    const now = new Date("2026-03-08T12:00:00.000Z"); // 08:00 EDT
    assert.equal(
      calendarDaysUntil("2026-03-08T18:00:00.000Z", "America/New_York", now),
      0,
    );
    assert.equal(
      calendarDaysUntil("2026-03-09T12:00:00.000Z", "America/New_York", now),
      1,
    );
  });
});

describe("assessmentCountdown", () => {
  const tz = "Europe/Madrid";

  it("date-only uses calendar days and refuses invented clock precision", () => {
    const now = new Date("2026-11-14T10:00:00.000Z");
    const parts = assessmentCountdown({
      startsAt: "2026-11-20T00:00:00.000Z",
      allDay: true,
      timeZone: tz,
      now,
    });
    assert.equal(parts.hasTime, false);
    assert.equal(parts.remainingMs, null);
    assert.match(parts.detailedLabel, /hourly precision/i);
    assert.ok(parts.days >= 5);
    assert.equal(parts.isPast, false);
  });

  it("timed assessments expose detailed remaining time", () => {
    const now = new Date("2026-11-14T10:00:00.000Z");
    const parts = assessmentCountdown({
      startsAt: "2026-11-14T15:30:00.000Z",
      allDay: false,
      timeZone: tz,
      now,
    });
    assert.equal(parts.hasTime, true);
    assert.ok((parts.remainingMs ?? 0) > 0);
    assert.equal(parts.hours, 5);
    assert.equal(parts.minutes, 30);
    assert.match(parts.detailedLabel, /5h/);
  });

  it("never shows negative remaining for past timed events", () => {
    const now = new Date("2026-11-20T12:00:00.000Z");
    const parts = assessmentCountdown({
      startsAt: "2026-11-10T09:00:00.000Z",
      allDay: false,
      timeZone: tz,
      now,
    });
    assert.equal(parts.isPast, true);
    assert.equal(parts.remainingMs, 0);
    assert.equal(parts.daysLabel, "Passed");
  });

  it("formats detailed countdown with days + hours + minutes", () => {
    const now = new Date("2026-11-14T10:00:00.000Z");
    const parts = assessmentCountdown({
      startsAt: "2026-11-16T12:00:00.000Z",
      allDay: false,
      timeZone: "UTC",
      now,
    });
    assert.match(parts.detailedLabel, /\d+d \d+h \d+m/);
  });
});
