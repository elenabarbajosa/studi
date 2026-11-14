import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dueLabel,
  layoutLanes,
  parseQuickAdd,
  quickDueDate,
  startOfWeek,
  taskGroup,
  toDateKey,
} from "@/lib/planning";

const NOW = new Date(2026, 10, 14, 15, 0); // Sat 14 Nov 2026, 15:00 local

describe("parseQuickAdd", () => {
  const subjects = [
    { id: "calc", name: "Cálculo I" },
    { id: "alg", name: "Álgebra Lineal" },
    { id: "ada", name: "Análisis y Diseño de Algoritmos" },
  ];

  it("extracts subject, priority and due tokens", () => {
    assert.deepEqual(parseQuickAdd("Review limits @calc !!! tomorrow", subjects), {
      title: "Review limits",
      subjectId: "calc",
      priority: "critical",
      due: "tomorrow",
    });
  });

  it("matches subjects by any word prefix, ignoring accents", () => {
    assert.equal(parseQuickAdd("Lab @diseno", subjects).subjectId, "ada");
    assert.equal(parseQuickAdd("Sheet @algebra", subjects).subjectId, "alg");
  });

  it("keeps unknown tokens in the title", () => {
    const r = parseQuickAdd("Email @nobody about week 3!", subjects);
    assert.equal(r.title, "Email @nobody about 3!");
    assert.equal(r.subjectId, null);
    assert.equal(r.due, "week");
  });

  it("maps ! to medium and !! to high", () => {
    assert.equal(parseQuickAdd("a !", subjects).priority, "medium");
    assert.equal(parseQuickAdd("a !!", subjects).priority, "high");
  });
});

describe("quickDueDate", () => {
  it("resolves today, tomorrow and the coming Sunday", () => {
    assert.equal(quickDueDate("today", NOW), "2026-11-14");
    assert.equal(quickDueDate("tomorrow", NOW), "2026-11-15");
    assert.equal(quickDueDate("week", NOW), "2026-11-15");
    assert.equal(quickDueDate("week", new Date(2026, 10, 9)), "2026-11-15");
  });
});

describe("dueLabel", () => {
  it("labels today with time, and all-day due dates without", () => {
    assert.deepEqual(dueLabel(new Date(2026, 10, 14, 18, 0).toISOString(), NOW), {
      label: "Today 18:00",
      tone: "today",
    });
    assert.equal(dueLabel(new Date(2026, 10, 14, 23, 59, 59).toISOString(), NOW).label, "Today");
  });

  it("flags past due dates as overdue", () => {
    assert.equal(dueLabel(new Date(2026, 10, 12, 23, 59, 59).toISOString(), NOW).tone, "overdue");
    assert.equal(dueLabel(new Date(2026, 10, 14, 9, 0).toISOString(), NOW).tone, "overdue");
  });

  it("uses weekday names within a week and dates beyond", () => {
    assert.equal(dueLabel(new Date(2026, 10, 15, 23, 59, 59).toISOString(), NOW).label, "Tomorrow");
    assert.equal(dueLabel(new Date(2026, 10, 18, 23, 59, 59).toISOString(), NOW).label, "Wed");
    assert.equal(dueLabel(new Date(2026, 10, 30, 23, 59, 59).toISOString(), NOW).label, "30 Nov");
  });
});

describe("taskGroup", () => {
  it("buckets by calendar day", () => {
    assert.equal(taskGroup(null, NOW), "none");
    assert.equal(taskGroup(new Date(2026, 10, 13).toISOString(), NOW), "overdue");
    assert.equal(taskGroup(new Date(2026, 10, 14, 20).toISOString(), NOW), "today");
    assert.equal(taskGroup(new Date(2026, 10, 15).toISOString(), NOW), "tomorrow");
    assert.equal(taskGroup(new Date(2026, 10, 20).toISOString(), NOW), "week");
    assert.equal(taskGroup(new Date(2026, 10, 21).toISOString(), NOW), "later");
  });
});

describe("startOfWeek", () => {
  it("returns Monday, including from a Sunday", () => {
    assert.equal(toDateKey(startOfWeek(NOW)), "2026-11-09");
    assert.equal(toDateKey(startOfWeek(new Date(2026, 10, 15))), "2026-11-09");
    assert.equal(toDateKey(startOfWeek(new Date(2026, 10, 16))), "2026-11-16");
  });
});

describe("layoutLanes", () => {
  it("splits overlapping items and leaves separate ones full width", () => {
    const out = layoutLanes([
      { id: "a", start: 600, end: 660 },
      { id: "b", start: 630, end: 700 },
      { id: "c", start: 720, end: 780 },
    ]);
    const byId = Object.fromEntries(out.map((o) => [o.id, o]));
    assert.deepEqual([byId.a.lane, byId.a.lanes], [0, 2]);
    assert.deepEqual([byId.b.lane, byId.b.lanes], [1, 2]);
    assert.deepEqual([byId.c.lane, byId.c.lanes], [0, 1]);
  });

  it("reuses a lane once it frees up inside a cluster", () => {
    const out = layoutLanes([
      { id: "a", start: 0, end: 100 },
      { id: "b", start: 10, end: 30 },
      { id: "c", start: 40, end: 60 },
    ]);
    const byId = Object.fromEntries(out.map((o) => [o.id, o]));
    assert.equal(byId.c.lane, 1);
    assert.equal(byId.c.lanes, 2);
  });
});
