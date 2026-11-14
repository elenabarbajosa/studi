import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWeekBars,
  daysUntil,
  formatBarValue,
  formatFocusDuration,
  pickUpNext,
  sortByPriority,
} from "@/lib/dashboard";
import type { Task } from "@/types/database";

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  return {
    user_id: "u",
    subject_id: null,
    topic_id: null,
    title: partial.id,
    description: null,
    due_at: null,
    scheduled_start: null,
    scheduled_end: null,
    priority: "medium",
    estimated_minutes: null,
    status: "todo",
    completed_at: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("sortByPriority", () => {
  it("orders by rank, not alphabetically, then by due date", () => {
    const sorted = sortByPriority([
      task({ id: "low", priority: "low" }),
      task({ id: "med-late", priority: "medium", due_at: "2026-11-14T18:00:00Z" }),
      task({ id: "crit", priority: "critical" }),
      task({ id: "med-early", priority: "medium", due_at: "2026-11-14T09:00:00Z" }),
      task({ id: "high", priority: "high" }),
    ]);
    assert.deepEqual(
      sorted.map((t) => t.id),
      ["crit", "high", "med-early", "med-late", "low"],
    );
  });
});

describe("pickUpNext", () => {
  const calc = "subject-calc";

  it("prefers the highest-priority task for the nearest exam's subject", () => {
    const result = pickUpNext({
      todayTasks: [
        task({ id: "other", priority: "critical" }),
        task({ id: "calc-med", subject_id: calc, priority: "medium" }),
      ],
      overdueTasks: [task({ id: "calc-high", subject_id: calc, priority: "high" })],
      nextAssessment: { subject_id: calc },
    });
    assert.equal(result?.task.id, "calc-high");
    assert.equal(result?.reason, "exam");
  });

  it("falls back to today's highest-priority task", () => {
    const result = pickUpNext({
      todayTasks: [task({ id: "a", priority: "low" }), task({ id: "b", priority: "high" })],
      overdueTasks: [task({ id: "late", priority: "critical" })],
      nextAssessment: { subject_id: calc },
    });
    assert.equal(result?.task.id, "b");
    assert.equal(result?.reason, "today");
  });

  it("uses overdue work when nothing is due today", () => {
    const result = pickUpNext({
      todayTasks: [],
      overdueTasks: [task({ id: "late" })],
      nextAssessment: null,
    });
    assert.equal(result?.reason, "overdue");
  });

  it("returns null with no open tasks", () => {
    assert.equal(
      pickUpNext({ todayTasks: [], overdueTasks: [], nextAssessment: null }),
      null,
    );
  });
});

describe("daysUntil", () => {
  const now = new Date(2026, 10, 14, 21, 30);
  it("counts calendar days, not 24h blocks", () => {
    assert.equal(daysUntil(new Date(2026, 10, 14, 23, 0).toISOString(), now), 0);
    assert.equal(daysUntil(new Date(2026, 10, 15, 8, 0).toISOString(), now), 1);
    assert.equal(daysUntil(new Date(2026, 10, 19, 9, 0).toISOString(), now), 5);
  });

  it("keeps date-only local-midnight assessments on the intended day", () => {
    // All-day Nov 20 stored from a UTC+1 browser → 2026-11-19T23:00:00.000Z
    const stored = new Date(2026, 10, 20, 0, 0, 0).toISOString();
    assert.equal(daysUntil(stored, now), 6);
  });
});

describe("formatting", () => {
  it("formats focus totals", () => {
    assert.equal(formatFocusDuration(0), "0m");
    assert.equal(formatFocusDuration(45 * 60), "45m");
    assert.equal(formatFocusDuration(12 * 3600 + 40 * 60), "12h 40m");
    assert.equal(formatFocusDuration(3600 + 5 * 60), "1h 05m");
  });

  it("formats bar labels", () => {
    assert.equal(formatBarValue(0), "");
    assert.equal(formatBarValue(45 * 60), "45m");
    assert.equal(formatBarValue(2.4 * 3600), "2.4h");
  });
});

describe("buildWeekBars", () => {
  it("builds a Monday-first week and marks today", () => {
    const saturday = new Date(2026, 10, 14, 12, 0);
    const mondayKey = new Date(2026, 10, 9).toISOString().slice(0, 10);
    const bars = buildWeekBars([{ date: mondayKey, seconds: 3600 }], saturday);
    assert.equal(bars.length, 7);
    assert.equal(bars[0].dayName, "Monday");
    assert.equal(bars[0].seconds, 3600);
    assert.equal(bars[5].isToday, true);
    assert.equal(bars[6].isFuture, true);
    assert.equal(bars[4].isFuture, false);
  });

  it("treats Sunday as the end of the week", () => {
    const sunday = new Date(2026, 10, 15, 12, 0);
    const bars = buildWeekBars([], sunday);
    assert.equal(bars[6].isToday, true);
    assert.equal(bars[0].key, new Date(2026, 10, 9).toISOString().slice(0, 10));
  });
});
