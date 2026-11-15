import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectExternalPlanConflicts,
  externalEventToBusy,
  mergeBusyIntervals,
  showAsBlocksStudy,
} from "@/lib/calendar-sync/busy";

describe("showAsBlocksStudy", () => {
  it("does not block free; blocks busy/tentative/oof/unknown", () => {
    assert.equal(showAsBlocksStudy("free"), false);
    assert.equal(showAsBlocksStudy("busy"), true);
    assert.equal(showAsBlocksStudy("tentative"), true);
    assert.equal(showAsBlocksStudy("oof"), true);
    assert.equal(showAsBlocksStudy("unknown"), true);
  });
});

describe("externalEventToBusy", () => {
  it("skips cancelled and free events", () => {
    assert.equal(
      externalEventToBusy({
        title: "Free slot",
        starts_at: "2026-11-16T10:00:00.000Z",
        ends_at: "2026-11-16T11:00:00.000Z",
        show_as: "free",
        is_cancelled: false,
        ical_uid: null,
      }),
      null,
    );
    assert.equal(
      externalEventToBusy({
        title: "Gone",
        starts_at: "2026-11-16T10:00:00.000Z",
        ends_at: "2026-11-16T11:00:00.000Z",
        show_as: "busy",
        is_cancelled: true,
        ical_uid: null,
      }),
      null,
    );
  });

  it("blocks all-day multi-day windows", () => {
    const busy = externalEventToBusy({
      title: "Trip",
      starts_at: "2026-12-01T00:00:00.000Z",
      ends_at: "2026-12-05T00:00:00.000Z",
      show_as: "busy",
      is_cancelled: false,
      ical_uid: "trip@x",
    });
    assert.ok(busy);
    assert.equal(busy!.startsAt, "2026-12-01T00:00:00.000Z");
    assert.equal(busy!.endsAt, "2026-12-05T00:00:00.000Z");
  });
});

describe("mergeBusyIntervals", () => {
  it("dedupes the same event from multiple providers via iCal UID", () => {
    const merged = mergeBusyIntervals(
      [],
      [
        {
          title: "Lecture",
          starts_at: "2026-11-16T14:00:00.000Z",
          ends_at: "2026-11-16T15:00:00.000Z",
          show_as: "busy",
          is_cancelled: false,
          ical_uid: "same-uid",
        },
        {
          title: "Lecture",
          starts_at: "2026-11-16T14:00:00.000Z",
          ends_at: "2026-11-16T15:00:00.000Z",
          show_as: "busy",
          is_cancelled: false,
          ical_uid: "same-uid",
        },
      ],
    );
    assert.equal(merged.length, 1);
  });

  it("merges overlapping busy intervals", () => {
    const merged = mergeBusyIntervals(
      [
        {
          startsAt: "2026-11-16T10:00:00.000Z",
          endsAt: "2026-11-16T11:00:00.000Z",
          label: "A",
        },
      ],
      [
        {
          title: "B",
          starts_at: "2026-11-16T10:30:00.000Z",
          ends_at: "2026-11-16T12:00:00.000Z",
          show_as: "busy",
          is_cancelled: false,
          ical_uid: "b",
        },
      ],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.endsAt, "2026-11-16T12:00:00.000Z");
  });
});

describe("detectExternalPlanConflicts", () => {
  it("detects overlap with planned sessions", () => {
    const conflicts = detectExternalPlanConflicts(
      [
        {
          id: "s1",
          starts_at: "2026-11-16T14:00:00.000Z",
          ends_at: "2026-11-16T15:00:00.000Z",
          status: "planned",
        },
      ],
      [
        {
          id: "e1",
          title: "Class",
          starts_at: "2026-11-16T14:30:00.000Z",
          ends_at: "2026-11-16T16:00:00.000Z",
          show_as: "busy",
          is_cancelled: false,
          ical_uid: null,
        },
      ],
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]!.sessionId, "s1");
  });

  it("ignores free external events", () => {
    const conflicts = detectExternalPlanConflicts(
      [
        {
          id: "s1",
          starts_at: "2026-11-16T14:00:00.000Z",
          ends_at: "2026-11-16T15:00:00.000Z",
          status: "planned",
        },
      ],
      [
        {
          id: "e1",
          title: "Optional",
          starts_at: "2026-11-16T14:00:00.000Z",
          ends_at: "2026-11-16T15:00:00.000Z",
          show_as: "free",
          is_cancelled: false,
          ical_uid: null,
        },
      ],
    );
    assert.equal(conflicts.length, 0);
  });
});
