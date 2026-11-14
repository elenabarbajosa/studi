import type { TopicNodeForAi } from "@/lib/canvas/types";
import type { Topic } from "@/types/database";

/**
 * Topic columns used when ordering for Canvas AI classification.
 * Must match `public.topics` (migration 003) — there is no `position` column.
 */
export const CANVAS_TOPIC_ORDER_COLUMNS = ["sort_order", "created_at"] as const;

export type CanvasTopicRow = Pick<Topic, "id" | "title" | "parent_id" | "sort_order">;

/** Build Gemini topic nodes with parent titles, preserving given row order. */
export function topicNodesForClassification(topics: CanvasTopicRow[]): TopicNodeForAi[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  return topics.map((t) => ({
    id: t.id,
    title: t.title,
    parentTitle: t.parent_id ? (byId.get(t.parent_id)?.title ?? null) : null,
  }));
}
