import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addMonths,
  buildMonthGrid,
  isSameMonth,
  startOfMonth,
} from "@/lib/calendar-month";
import { toDateKey } from "@/lib/planning";

describe("buildMonthGrid", () => {
  it("is Monday-first and includes full weeks only", () => {
    // November 2026 starts on Sunday → grid starts Mon 26 Oct
    const grid = buildMonthGrid(new Date(2026, 10, 1));
    assert.equal(grid[0]!.getDay(), 1);
    assert.equal(toDateKey(grid[0]!), "2026-10-26");
    assert.ok(grid.length === 35 || grid.length === 42);
    assert.equal(grid.length % 7, 0);
  });

  it("covers leap-day February 2024", () => {
    const grid = buildMonthGrid(new Date(2024, 1, 15));
    const keys = grid.map(toDateKey);
    assert.ok(keys.includes("2024-02-29"));
    assert.ok(keys.every((k, i) => i === 0 || k > keys[i - 1]!));
  });

  it("keeps selected day pickable inside month boundaries", () => {
    const selected = new Date(2026, 10, 14);
    const grid = buildMonthGrid(selected);
    assert.ok(grid.some((d) => toDateKey(d) === "2026-11-14"));
    assert.ok(grid.some((d) => isSameMonth(d, selected)));
  });
});

describe("addMonths / startOfMonth", () => {
  it("avoids day overflow from 31 Jan", () => {
    const feb = addMonths(new Date(2026, 0, 31), 1);
    assert.equal(feb.getMonth(), 1);
    assert.equal(feb.getDate(), 28);
  });

  it("normalizes to the first of the month", () => {
    const first = startOfMonth(new Date(2026, 10, 14));
    assert.equal(toDateKey(first), "2026-11-01");
  });
});
