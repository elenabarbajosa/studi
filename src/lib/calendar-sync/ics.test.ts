import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseIcs } from "@/lib/calendar-sync/ics";

describe("parseIcs", () => {
  it("parses timed and all-day events with UID", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:exam-1@example.com
DTSTART:20261120T090000Z
DTEND:20261120T110000Z
SUMMARY:Midterm Exam
END:VEVENT
BEGIN:VEVENT
UID:trip@example.com
DTSTART;VALUE=DATE:20261201
DTEND;VALUE=DATE:20261205
SUMMARY:Trip home
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.events.length, 2);
    const timed = result.events.find((e) => e.icalUid === "exam-1@example.com");
    assert.ok(timed);
    assert.equal(timed!.allDay, false);
    assert.equal(timed!.title, "Midterm Exam");
    const allDay = result.events.find((e) => e.icalUid === "trip@example.com");
    assert.ok(allDay);
    assert.equal(allDay!.allDay, true);
  });

  it("expands daily RRULE and respects EXDATE", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:class@example.com
DTSTART:20261116T140000Z
DTEND:20261116T150000Z
RRULE:FREQ=DAILY;COUNT=3
EXDATE:20261117T140000Z
SUMMARY:Lecture
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.events.length, 2);
    assert.ok(result.events.every((e) => e.title === "Lecture"));
    assert.ok(
      !result.events.some((e) => e.startsAt.startsWith("2026-11-17")),
    );
  });

  it("marks CANCELLED events", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:x@example.com
DTSTART:20261120T090000Z
SUMMARY:Cancelled
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.events[0]?.isCancelled, true);
  });

  it("rejects malformed and oversized input", () => {
    assert.equal(parseIcs("not a calendar").ok, false);
    const huge = "BEGIN:VCALENDAR\n" + "A".repeat(3 * 1024 * 1024);
    assert.equal(parseIcs(huge).ok, false);
  });

  it("applies RECURRENCE-ID exception override", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:series@example.com
DTSTART:20261116T100000Z
DTEND:20261116T110000Z
RRULE:FREQ=DAILY;COUNT=2
SUMMARY:Class
END:VEVENT
BEGIN:VEVENT
UID:series@example.com
RECURRENCE-ID:20261117T100000Z
DTSTART:20261117T120000Z
DTEND:20261117T130000Z
SUMMARY:Moved class
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const moved = result.events.find((e) => e.title === "Moved class");
    assert.ok(moved);
    assert.ok(moved!.startsAt.includes("T12:"));
  });
});
