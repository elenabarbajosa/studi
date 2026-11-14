import type { CanvasClassification } from "@/lib/canvas/types";
import { canvasClassificationResponseSchema } from "@/lib/canvas/schemas";

/**
 * Validate AI classifications against the caller's topic IDs and inventory localIds.
 * Drops unknown topic IDs; fills missing items as unassigned.
 */
export function validateClassifications(
  raw: unknown,
  allowedTopicIds: Set<string>,
  inventoryLocalIds: string[],
): CanvasClassification[] {
  const parsed = canvasClassificationResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Gemini returned data that did not match the expected classification shape.",
    );
  }

  const byId = new Map<string, CanvasClassification>();
  for (const row of parsed.data.classifications) {
    if (!inventoryLocalIds.includes(row.localId)) continue;
    let topicId = row.topicId ?? null;
    if (topicId && !allowedTopicIds.has(topicId)) {
      topicId = null;
    }
    const confidence = topicId
      ? row.confidence === "none"
        ? "low"
        : row.confidence
      : "none";
    byId.set(row.localId, {
      localId: row.localId,
      topicId,
      confidence,
      explanation: (
        row.explanation || (topicId ? "Matched by AI" : "No reliable match")
      ).slice(0, 280),
    });
  }

  return inventoryLocalIds.map((localId) => {
    const existing = byId.get(localId);
    if (existing) return existing;
    return {
      localId,
      topicId: null,
      confidence: "none" as const,
      explanation: "No suggestion returned",
    };
  });
}
