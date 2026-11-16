import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { destinationToCalItemKind } from "@/lib/calendar-items";
import {
  applyCalendarBlocksStudy,
  applyCalendarDestination,
  applyCalendarEnabledToggle,
  doesExternalCalendarBlockStudy,
  eventEligibleToBlockStudy,
  filterBlockingExternalEvents,
  filterVisibleExternalEvents,
  isExternalCalendarVisible,
  migratedExternalCalendarDefaults,
  normalizeExternalCalendarDestination,
} from "@/lib/calendar-sync/calendar-settings";

function cal(partial: {
  id: string;
  enabled: boolean;
  blocks_study?: boolean;
  studi_destination?: "exams" | "deadlines" | "tasks" | "personal" | "external";
}) {
  return {
    id: partial.id,
    enabled: partial.enabled,
    blocks_study: partial.blocks_study ?? true,
    studi_destination: partial.studi_destination ?? "external",
  };
}

function event(partial: {
  id: string;
  calendar_id: string;
  show_as?: "busy" | "free";
  is_cancelled?: boolean;
}) {
  return {
    id: partial.id,
    calendar_id: partial.calendar_id,
    show_as: partial.show_as ?? "busy",
    is_cancelled: partial.is_cancelled ?? false,
  };
}

describe("external calendar enable/disable lifecycle", () => {
  for (const provider of ["icloud", "google", "outlook"] as const) {
    it(`${provider}: enabled → disabled → enabled restores settings`, () => {
      let calendar = {
        id: `${provider}-cal`,
        enabled: true,
        studi_destination: "exams" as const,
        blocks_study: true,
      };
      calendar = applyCalendarEnabledToggle(calendar, false);
      assert.equal(calendar.enabled, false);
      assert.equal(calendar.studi_destination, "exams");
      assert.equal(calendar.blocks_study, true);
      assert.equal(isExternalCalendarVisible(calendar), false);
      assert.equal(doesExternalCalendarBlockStudy(calendar), false);

      calendar = applyCalendarEnabledToggle(calendar, true);
      assert.equal(calendar.enabled, true);
      assert.equal(calendar.studi_destination, "exams");
      assert.equal(calendar.blocks_study, true);
      assert.equal(isExternalCalendarVisible(calendar), true);
      assert.equal(doesExternalCalendarBlockStudy(calendar), true);
    });
  }
});

describe("disabled calendars are fully excluded", () => {
  const calendars = [
    cal({ id: "a", enabled: true, blocks_study: true }),
    cal({ id: "b", enabled: false, blocks_study: true }),
  ];
  const events = [
    event({ id: "e1", calendar_id: "a" }),
    event({ id: "e2", calendar_id: "b" }),
  ];

  it("hides disabled events from Calendar aggregation", () => {
    const visible = filterVisibleExternalEvents(events, calendars);
    assert.deepEqual(
      visible.map((e) => e.id),
      ["e1"],
    );
  });

  it("hides disabled events from academic-suggestion eligibility", () => {
    // Same visibility gate used by listAcademicSuggestionsAction.
    const visible = filterVisibleExternalEvents(events, calendars);
    assert.equal(visible.some((e) => e.calendar_id === "b"), false);
  });

  it("never lets disabled calendars block study time", () => {
    assert.equal(
      eventEligibleToBlockStudy(events[1]!, calendars[1]),
      false,
    );
    const blocking = filterBlockingExternalEvents(events, calendars);
    assert.deepEqual(
      blocking.map((e) => e.id),
      ["e1"],
    );
  });
});

describe("destination mapping is presentation-only", () => {
  it("maps exams / tasks destinations to visual kinds without implying native records", () => {
    assert.equal(destinationToCalItemKind("exams"), "exam");
    assert.equal(destinationToCalItemKind("tasks"), "task");
    assert.equal(destinationToCalItemKind("deadlines"), "deadline");
    assert.equal(destinationToCalItemKind("personal"), "personal");
    assert.equal(destinationToCalItemKind("external"), "external");
  });

  it("updates existing calendar destination without changing identity fields", () => {
    const before = cal({
      id: "uni",
      enabled: true,
      studi_destination: "external",
    });
    const after = applyCalendarDestination(before, "exams");
    assert.equal(after.id, before.id);
    assert.equal(after.enabled, true);
    assert.equal(after.studi_destination, "exams");
    assert.equal(destinationToCalItemKind(after.studi_destination), "exam");
  });
});

describe("block study is independent of destination", () => {
  it("can show as Exams while not blocking study time", () => {
    let calendar = cal({
      id: "info",
      enabled: true,
      studi_destination: "exams",
      blocks_study: true,
    });
    calendar = applyCalendarBlocksStudy(calendar, false);
    assert.equal(calendar.studi_destination, "exams");
    assert.equal(doesExternalCalendarBlockStudy(calendar), false);
    assert.equal(
      eventEligibleToBlockStudy(
        event({ id: "e", calendar_id: "info", show_as: "busy" }),
        calendar,
      ),
      false,
    );
  });

  it("respects provider free status even when blocks_study is on", () => {
    const calendar = cal({ id: "p", enabled: true, blocks_study: true });
    assert.equal(
      eventEligibleToBlockStudy(
        event({ id: "e", calendar_id: "p", show_as: "free" }),
        calendar,
      ),
      false,
    );
  });
});

describe("migration and reconnect defaults", () => {
  it("preserves enabled/disabled for existing users", () => {
    assert.deepEqual(migratedExternalCalendarDefaults({ enabled: false }), {
      enabled: false,
      studi_destination: "external",
      blocks_study: true,
    });
    assert.deepEqual(migratedExternalCalendarDefaults({ enabled: true }), {
      enabled: true,
      studi_destination: "external",
      blocks_study: true,
    });
  });

  it("normalizes unknown destinations to external", () => {
    assert.equal(normalizeExternalCalendarDestination("nope"), "external");
    assert.equal(normalizeExternalCalendarDestination(undefined), "external");
    assert.equal(normalizeExternalCalendarDestination("tasks"), "tasks");
  });
});
