import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDailyFocusSeries,
  calendarDayKey,
} from "@/lib/focus/stats-days";

describe("calendarDayKey", () => {
  it("formats the runtime-local calendar day as YYYY-MM-DD", () => {
    const local = new Date(2026, 10, 14, 0, 30, 0);
    assert.equal(calendarDayKey(local), "2026-11-14");
  });

  it("respects an explicit IANA timezone", () => {
    assert.equal(
      calendarDayKey("2026-11-14T23:30:00.000Z", "Europe/Madrid"),
      "2026-11-15",
    );
    assert.equal(
      calendarDayKey("2026-11-14T23:30:00.000Z", "UTC"),
      "2026-11-14",
    );
  });
});

describe("buildDailyFocusSeries", () => {
  it("buckets sessions onto local calendar days", () => {
    const series = buildDailyFocusSeries(
      [
        { starts_at: "2026-11-14T10:00:00.000Z", focus_seconds: 600 },
        { starts_at: "2026-11-15T10:00:00.000Z", focus_seconds: 1200 },
      ],
      { startKey: "2026-11-14", dayCount: 3, timeZone: "UTC" },
    );
    assert.deepEqual(series, [
      { date: "2026-11-14", seconds: 600 },
      { date: "2026-11-15", seconds: 1200 },
      { date: "2026-11-16", seconds: 0 },
    ]);
  });

  it("keeps a UTC+ evening session on the local calendar day", () => {
    // 22:00 Madrid on Nov 14 is 21:00 UTC — still Nov 14 locally
    const series = buildDailyFocusSeries(
      [{ starts_at: "2026-11-14T21:00:00.000Z", focus_seconds: 900 }],
      { startKey: "2026-11-14", dayCount: 2, timeZone: "Europe/Madrid" },
    );
    assert.equal(series[0]?.seconds, 900);
    assert.equal(series[1]?.seconds, 0);
  });
});
