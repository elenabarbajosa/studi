import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveEffectiveTopicStatus,
  effectiveStatusByTopicId,
  topicProgressSummary,
  type TopicProgressNode,
} from "@/lib/topic-progress";
import type { TopicStatus } from "@/lib/subjects";

function topic(
  id: string,
  status: TopicStatus,
  parent_id: string | null = null,
): TopicProgressNode {
  return { id, status, parent_id };
}

describe("deriveEffectiveTopicStatus", () => {
  it("keeps leaf stored status", () => {
    const topics = [topic("a", "practicing")];
    const map = effectiveStatusByTopicId(topics);
    assert.equal(map.get("a"), "practicing");
  });

  it("marks empty parent as its stored status", () => {
    const topics = [topic("parent", "studying")];
    assert.equal(
      topicProgressSummary(topics).completionRatio,
      1 / 3,
    );
  });

  it("all children mastered → parent mastered", () => {
    const topics = [
      topic("p", "not_started"),
      topic("a", "mastered", "p"),
      topic("b", "mastered", "p"),
      topic("c", "mastered", "p"),
    ];
    const map = effectiveStatusByTopicId(topics);
    assert.equal(map.get("p"), "mastered");
    const summary = topicProgressSummary(topics);
    assert.equal(summary.mastered, 1);
    assert.equal(summary.total, 1);
    assert.equal(summary.completionRatio, 1);
  });

  it("all children not started → parent not started", () => {
    const topics = [
      topic("p", "mastered"),
      topic("a", "not_started", "p"),
      topic("b", "not_started", "p"),
    ];
    assert.equal(effectiveStatusByTopicId(topics).get("p"), "not_started");
    assert.equal(topicProgressSummary(topics).completionRatio, 0);
  });

  it("mixed statuses never show mastered", () => {
    const topics = [
      topic("p", "not_started"),
      topic("a", "mastered", "p"),
      topic("b", "not_started", "p"),
    ];
    assert.equal(effectiveStatusByTopicId(topics).get("p"), "studying");
  });

  it("partial practicing/mastered → practicing", () => {
    const topics = [
      topic("p", "not_started"),
      topic("a", "practicing", "p"),
      topic("b", "mastered", "p"),
    ];
    assert.equal(effectiveStatusByTopicId(topics).get("p"), "practicing");
  });

  it("supports multiple nested levels", () => {
    const topics = [
      topic("root", "not_started"),
      topic("ch", "not_started", "root"),
      topic("leaf1", "mastered", "ch"),
      topic("leaf2", "mastered", "ch"),
    ];
    const map = effectiveStatusByTopicId(topics);
    assert.equal(map.get("ch"), "mastered");
    assert.equal(map.get("root"), "mastered");
    assert.equal(topicProgressSummary(topics).completionRatio, 1);
  });

  it("reverts when a child leaves mastered", () => {
    const allMastered = [
      topic("p", "not_started"),
      topic("a", "mastered", "p"),
      topic("b", "mastered", "p"),
    ];
    assert.equal(effectiveStatusByTopicId(allMastered).get("p"), "mastered");

    const reverted = [
      topic("p", "not_started"),
      topic("a", "not_started", "p"),
      topic("b", "mastered", "p"),
    ];
    assert.equal(effectiveStatusByTopicId(reverted).get("p"), "studying");
    assert.ok((topicProgressSummary(reverted).completionRatio ?? 1) < 1);
  });

  it("does not double-count children in subject percentage", () => {
    const topics = [
      topic("p", "not_started"),
      topic("a", "mastered", "p"),
      topic("b", "mastered", "p"),
      topic("c", "mastered", "p"),
    ];
    // One root, fully mastered — not 3/3 leaf counting
    const summary = topicProgressSummary(topics);
    assert.equal(summary.total, 1);
    assert.equal(summary.mastered, 1);
  });

  it("memoizes via deriveEffectiveTopicStatus", () => {
    const topics = [
      topic("p", "not_started"),
      topic("a", "studying", "p"),
    ];
    const statusById = new Map(topics.map((t) => [t.id, t.status]));
    const children = new Map([["p", [{ id: "a" }]]]);
    const memo = new Map<string, TopicStatus>();
    const first = deriveEffectiveTopicStatus("p", statusById, children, memo);
    const second = deriveEffectiveTopicStatus("p", statusById, children, memo);
    assert.equal(first, "studying");
    assert.equal(second, "studying");
    assert.equal(memo.get("p"), "studying");
  });
});
