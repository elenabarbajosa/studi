import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dueAtFromForm,
  isDateOnlyDue,
  partitionTodoTasksByDueDay,
} from "@/lib/task-due";
import type { Task } from "@/types/database";

function task(partial: Partial<Task> & Pick<Task, "id" | "due_at">): Task {
  return {
    user_id: "u",
    subject_id: null,
    topic_id: null,
    title: partial.id,
    description: null,
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

describe("dueAtFromForm", () => {
  it("stores date-only dues at noon UTC", () => {
    assert.equal(dueAtFromForm("2026-11-14"), "2026-11-14T12:00:00.000Z");
    assert.equal(isDateOnlyDue("2026-11-14T12:00:00.000Z"), true);
  });

  it("returns null without a date (undated policy)", () => {
    assert.equal(dueAtFromForm(""), null);
    assert.equal(dueAtFromForm(null), null);
  });

  it("keeps timed dues as an ISO instant", () => {
    const iso = dueAtFromForm("2026-11-14", "09:30");
    assert.ok(iso);
    assert.equal(new Date(iso!).toISOString(), iso);
  });
});

describe("partitionTodoTasksByDueDay", () => {
  const tz = "Europe/Madrid";
  // 2026-11-14 15:00 UTC = 16:00 in Madrid (CET)
  const now = new Date("2026-11-14T15:00:00.000Z");

  it("places today, yesterday, tomorrow and undated correctly", () => {
    const today = task({ id: "today", due_at: "2026-11-14T12:00:00.000Z" });
    const yesterday = task({ id: "yest", due_at: "2026-11-13T12:00:00.000Z" });
    const tomorrow = task({ id: "tom", due_at: "2026-11-15T12:00:00.000Z" });
    const undated = task({ id: "none", due_at: null });

    const { todayTasks, overdueTasks } = partitionTodoTasksByDueDay(
      [today, yesterday, tomorrow, undated],
      tz,
      now,
    );

    assert.deepEqual(
      todayTasks.map((t) => t.id),
      ["today"],
    );
    assert.deepEqual(
      overdueTasks.map((t) => t.id),
      ["yest"],
    );
  });

  it("ignores completed tasks", () => {
    const done = task({
      id: "done",
      due_at: "2026-11-14T12:00:00.000Z",
      status: "completed",
    });
    const { todayTasks } = partitionTodoTasksByDueDay([done], tz, now);
    assert.equal(todayTasks.length, 0);
  });
});
