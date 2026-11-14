import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CANVAS_TOPIC_ORDER_COLUMNS,
  topicNodesForClassification,
} from "@/lib/canvas/topics";
import type { Topic } from "@/types/database";

const TOPIC_KEYS: (keyof Topic)[] = [
  "id",
  "user_id",
  "subject_id",
  "parent_id",
  "title",
  "status",
  "notes",
  "sort_order",
  "created_at",
  "updated_at",
];

describe("CANVAS_TOPIC_ORDER_COLUMNS", () => {
  it("only references real Topic columns (not position)", () => {
    for (const column of CANVAS_TOPIC_ORDER_COLUMNS) {
      assert.ok(
        (TOPIC_KEYS as string[]).includes(column),
        `Unknown topic column: ${column}`,
      );
    }
    assert.ok(CANVAS_TOPIC_ORDER_COLUMNS.includes("sort_order"));
    assert.ok(!(CANVAS_TOPIC_ORDER_COLUMNS as readonly string[]).includes("position"));
  });

  it("keeps canvas-import from ordering topics by a non-existent position column", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const actionSource = readFileSync(
      join(here, "../../actions/canvas-import.ts"),
      "utf8",
    );
    assert.equal(
      /\.order\(\s*["']position["']/.test(actionSource),
      false,
      "canvas-import must not order topics by position",
    );
    assert.match(actionSource, /CANVAS_TOPIC_ORDER_COLUMNS/);
    assert.match(actionSource, /sort_order/);
  });
});

describe("topicNodesForClassification", () => {
  it("preserves hierarchy titles and topic IDs for Gemini", () => {
    const parentId = "11111111-1111-4111-8111-111111111111";
    const childId = "22222222-2222-4222-8222-222222222222";
    const nodes = topicNodesForClassification([
      {
        id: parentId,
        title: "Module 1",
        parent_id: null,
        sort_order: 0,
      },
      {
        id: childId,
        title: "Atoms",
        parent_id: parentId,
        sort_order: 0,
      },
    ]);

    assert.deepEqual(nodes, [
      { id: parentId, title: "Module 1", parentTitle: null },
      { id: childId, title: "Atoms", parentTitle: "Module 1" },
    ]);
  });
});
