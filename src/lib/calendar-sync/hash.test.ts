import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { contentHashForEvent, dedupeFingerprint } from "@/lib/calendar-sync/hash";

describe("contentHashForEvent", () => {
  it("is stable for identical events and changes when title changes", () => {
    const base = {
      providerEventId: "1",
      title: "A",
      startsAt: "2026-11-16T10:00:00.000Z",
      endsAt: "2026-11-16T11:00:00.000Z",
      allDay: false,
      showAs: "busy" as const,
      isCancelled: false,
    };
    const a = contentHashForEvent(base);
    const b = contentHashForEvent(base);
    const c = contentHashForEvent({ ...base, title: "B" });
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});

describe("dedupeFingerprint", () => {
  it("matches across providers with same UID and time", () => {
    const a = dedupeFingerprint({
      icalUid: "UID@x",
      title: "Class",
      startsAt: "2026-11-16T10:00:00.000Z",
      endsAt: "2026-11-16T11:00:00.000Z",
    });
    const b = dedupeFingerprint({
      icalUid: "uid@x",
      title: "Class",
      startsAt: "2026-11-16T10:00:00.000Z",
      endsAt: "2026-11-16T11:00:00.000Z",
    });
    assert.equal(a, b);
  });
});
