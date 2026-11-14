import {
  TOPIC_STATUS_META,
  type TopicStatus,
} from "@/lib/subjects";

export type TopicProgressNode = {
  id: string;
  status: TopicStatus;
  parent_id: string | null;
};

/** Build parent → children map (children unsorted; callers may sort). */
export function childrenByParentId<T extends TopicProgressNode>(
  topics: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const topic of topics) {
    if (!topic.parent_id) continue;
    const list = map.get(topic.parent_id) ?? [];
    list.push(topic);
    map.set(topic.parent_id, list);
  }
  return map;
}

/**
 * Effective status of a topic for display and progress.
 * Leaves keep their stored status. Parents with children derive from
 * descendants (recursive) and never write back to the database.
 *
 * Rules:
 * - no children → stored status
 * - all effective children not_started → not_started
 * - all effective children mastered → mastered
 * - all children practicing or mastered (and at least one practicing) → practicing
 * - otherwise → studying (partial / mixed progress)
 */
export function deriveEffectiveTopicStatus(
  topicId: string,
  statusById: ReadonlyMap<string, TopicStatus>,
  childrenByParent: ReadonlyMap<string, { id: string }[]>,
  memo: Map<string, TopicStatus> = new Map(),
): TopicStatus {
  const cached = memo.get(topicId);
  if (cached) return cached;

  const children = childrenByParent.get(topicId) ?? [];
  if (children.length === 0) {
    const leaf = statusById.get(topicId) ?? "not_started";
    memo.set(topicId, leaf);
    return leaf;
  }

  const childStatuses = children.map((child) =>
    deriveEffectiveTopicStatus(child.id, statusById, childrenByParent, memo),
  );

  let derived: TopicStatus;
  if (childStatuses.every((s) => s === "not_started")) {
    derived = "not_started";
  } else if (childStatuses.every((s) => s === "mastered")) {
    derived = "mastered";
  } else if (
    childStatuses.every((s) => s === "practicing" || s === "mastered") &&
    childStatuses.some((s) => s === "practicing")
  ) {
    derived = "practicing";
  } else {
    derived = "studying";
  }

  memo.set(topicId, derived);
  return derived;
}

export function effectiveStatusByTopicId(
  topics: TopicProgressNode[],
): Map<string, TopicStatus> {
  const statusById = new Map(topics.map((t) => [t.id, t.status]));
  const children = childrenByParentId(topics);
  const memo = new Map<string, TopicStatus>();
  for (const topic of topics) {
    deriveEffectiveTopicStatus(topic.id, statusById, children, memo);
  }
  return memo;
}

/**
 * Weighted progress over top-level topics, using derived statuses so nested
 * children roll up without double-counting parent + child rows.
 *
 * Percentage semantics: each root topic contributes equally (weight 0–3 from
 * its effective status). Empty parents with no children use their stored
 * status. Parents with children use the derived roll-up only.
 */
export function topicProgressSummary(topics: TopicProgressNode[]) {
  const effective = effectiveStatusByTopicId(topics);
  const roots = topics.filter((t) => t.parent_id === null);
  const total = roots.length;
  const statuses = roots.map(
    (t) => effective.get(t.id) ?? t.status,
  );
  const mastered = statuses.filter((s) => s === "mastered").length;
  const inProgress = statuses.filter(
    (s) => s === "studying" || s === "practicing",
  ).length;
  const notStarted = statuses.filter((s) => s === "not_started").length;
  const weightSum = statuses.reduce(
    (sum, s) => sum + TOPIC_STATUS_META[s].weight,
    0,
  );
  const maxWeight = total * TOPIC_STATUS_META.mastered.weight;

  return {
    total,
    mastered,
    inProgress,
    notStarted,
    completionRatio: maxWeight === 0 ? null : weightSum / maxWeight,
  };
}

export function topicHasChildren(
  topicId: string,
  childrenByParent: ReadonlyMap<string, { id: string }[]>,
) {
  return (childrenByParent.get(topicId)?.length ?? 0) > 0;
}
