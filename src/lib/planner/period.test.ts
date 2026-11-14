import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PlannerPreferencesInput } from "@/lib/planner/schemas";
import {
  ensureDayAvailability,
  resolvePeriodBounds,
} from "@/lib/planner/period";
import { DEFAULT_PLANNER_TIME_WINDOWS } from "@/lib/planner/types";
import { DEFAULT_WEEKDAY_AVAILABILITY } from "@/lib/subjects";

function basePrefs(
  overrides: Partial<PlannerPreferencesInput> = {},
): PlannerPreferencesInput {
  return {
    planning_period: "14",
    intensity: "balanced",
    max_hours_per_day: 4,
    preferred_session_minutes: 50,
    break_minutes: 10,
    include_revision: true,
    include_incomplete_tasks: true,
    weekday_availability: { ...DEFAULT_WEEKDAY_AVAILABILITY },
    time_windows: structuredClone(DEFAULT_PLANNER_TIME_WINDOWS),
    rest_days: ["sat", "sun"],
    included_subject_ids: null,
    prioritized_topic_ids: [],
    excluded_topic_ids: [],
    until_assessment_id: null,
    target_date: null,
    user_instruction: "",
    ...overrides,
  };
}

describe("resolvePeriodBounds one-day", () => {
  const now = new Date("2026-11-14T15:30:00.000Z"); // Saturday afternoon UTC

  it("plans only today", () => {
    const bounds = resolvePeriodBounds(basePrefs({ planning_period: "today" }), "UTC", [], now);
    assert.deepEqual(bounds, { periodStart: "2026-11-14", periodEnd: "2026-11-14" });
  });

  it("plans only tomorrow", () => {
    const bounds = resolvePeriodBounds(
      basePrefs({ planning_period: "tomorrow" }),
      "UTC",
      [],
      now,
    );
    assert.deepEqual(bounds, { periodStart: "2026-11-15", periodEnd: "2026-11-15" });
  });

  it("uses custom target date", () => {
    const bounds = resolvePeriodBounds(
      basePrefs({ planning_period: "custom", target_date: "2026-11-20" }),
      "UTC",
      [],
      now,
    );
    assert.deepEqual(bounds, { periodStart: "2026-11-20", periodEnd: "2026-11-20" });
  });

  it("keeps longer 7-day windows", () => {
    const bounds = resolvePeriodBounds(basePrefs({ planning_period: "7" }), "UTC", [], now);
    assert.equal(bounds.periodStart, "2026-11-14");
    assert.equal(bounds.periodEnd, "2026-11-20");
  });
});

describe("ensureDayAvailability", () => {
  it("opens a rest day so one-day planning can place sessions", () => {
    // 2026-11-14 is Saturday
    const prefs = ensureDayAvailability(
      basePrefs(),
      "2026-11-14",
      "UTC",
    );
    assert.equal(prefs.weekday_availability.sat, true);
    assert.ok((prefs.time_windows.sat?.length ?? 0) > 0);
    assert.ok(!prefs.rest_days.includes("sat"));
  });
});
