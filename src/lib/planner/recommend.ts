import "server-only";

import { createGeminiClient, getGeminiModel } from "@/lib/ai/client";
import { AiFeatureError, mapGeminiError } from "@/lib/ai/errors";
import {
  buildHeuristicAllocations,
  type PlannerContextSnapshot,
} from "@/lib/planner/heuristic";
import {
  aiPlanRecommendationSchema,
  geminiPlanRecommendationJsonSchema,
  type AiPlanRecommendation,
} from "@/lib/planner/schemas";
import type { SubjectAllocation } from "@/lib/planner/types";

export type { PlannerContextSnapshot };
export { buildHeuristicAllocations };

export async function generateAiRecommendations(
  context: PlannerContextSnapshot,
): Promise<{ recommendation: AiPlanRecommendation; model: string; usedAi: boolean }> {
  const allowedIds = new Set(context.subjects.map((s) => s.id));
  const topicIds = new Set(
    context.subjects.flatMap((s) => s.unmasteredTopics.map((t) => t.id)),
  );

  const prompt = `You are Studi's study planning advisor.
Return JSON recommendations only. Use only the subjectId and topicId values provided.
Do not invent exams, deadlines, achievements, or study history.
Keep reasoning under 160 characters. suggestedMinutes are totals for the whole planning period.

Planning window: ${context.periodStart} → ${context.periodEnd} (${context.timeZone})
Intensity: ${context.intensity}
Include revision: ${context.includeRevision}

Subjects:
${context.subjects
  .map(
    (s) =>
      `- ${s.id} | ${s.name} | difficulty ${s.difficulty ?? "unknown"} | topics: ${
        s.unmasteredTopics.map((t) => `${t.id}:${t.title}(${t.status})`).join(", ") || "none open"
      }`,
  )
  .join("\n")}

Upcoming assessments (only these exist):
${
  context.assessments.length
    ? context.assessments
        .map(
          (a) =>
            `- ${a.id} | ${a.title} | ${a.type} | subject ${a.subjectId ?? "none"} | ${a.startsAt} | daysUntil ${a.daysUntil ?? "?"}`,
        )
        .join("\n")
    : "(none)"
}

Incomplete tasks:
${
  context.incompleteTasks.length
    ? context.incompleteTasks
        .slice(0, 20)
        .map(
          (t) =>
            `- ${t.id} | ${t.title} | subject ${t.subjectId ?? "none"} | priority ${t.priority} | due ${t.dueAt ?? "none"}`,
        )
        .join("\n")
    : "(none)"
}

Recent focus minutes by subject id:
${JSON.stringify(context.recentFocusMinutesBySubject)}
`;

  const model = getGeminiModel();
  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction:
          "You prioritize study work for a university student. Never invent data. Output JSON only.",
        responseMimeType: "application/json",
        responseJsonSchema: geminiPlanRecommendationJsonSchema,
        automaticContinuation: false,
        temperature: 0.3,
      },
    });
    const text = response.text?.trim() ?? "";
    if (!text) throw new AiFeatureError("parse_error", "Gemini returned an empty plan recommendation.");
    const json = JSON.parse(text) as unknown;
    const parsed = aiPlanRecommendationSchema.safeParse(json);
    if (!parsed.success) {
      throw new AiFeatureError("parse_error", "Gemini returned an invalid plan recommendation.");
    }

    const recommendation: AiPlanRecommendation = {
      ...parsed.data,
      subjectPriorities: parsed.data.subjectPriorities.filter((s) => allowedIds.has(s.subjectId)),
      revisionTopics: parsed.data.revisionTopics.filter((s) => allowedIds.has(s.subjectId)),
      practiceNeeded: parsed.data.practiceNeeded.filter((s) => allowedIds.has(s.subjectId)),
    };
    recommendation.revisionTopics = recommendation.revisionTopics.map((r) => ({
      ...r,
      topicId: r.topicId && topicIds.has(r.topicId) ? r.topicId : null,
    }));

    return { recommendation, model, usedAi: true };
  } catch (error) {
    if (error instanceof AiFeatureError && error.code === "quota_exhausted") throw error;
    if (error instanceof AiFeatureError && error.code === "parse_error") {
      const { recommendation } = buildHeuristicAllocations(context);
      recommendation.workloadWarnings = [
        ...recommendation.workloadWarnings,
        "AI recommendation was incomplete, so Studi used a deterministic fallback.",
      ];
      return { recommendation, model, usedAi: false };
    }
    if (
      error instanceof AiFeatureError &&
      (error.code === "forbidden" || error.code === "not_configured")
    ) {
      throw error;
    }
    const mapped = mapGeminiError(error);
    if (
      mapped.code === "quota_exhausted" ||
      mapped.code === "forbidden" ||
      mapped.code === "not_configured"
    ) {
      throw mapped;
    }
    const { recommendation } = buildHeuristicAllocations(context);
    recommendation.workloadWarnings = [
      ...recommendation.workloadWarnings,
      "AI was unavailable, so Studi used a deterministic fallback.",
    ];
    return { recommendation, model, usedAi: false };
  }
}

export function allocationsFromRecommendation(
  context: PlannerContextSnapshot,
  recommendation: AiPlanRecommendation,
): SubjectAllocation[] {
  const allocations: SubjectAllocation[] = [];
  const examBySubject = new Map<string, string>();
  for (const a of context.assessments) {
    if (!a.subjectId) continue;
    const key = a.startsAt.slice(0, 10);
    const existing = examBySubject.get(a.subjectId);
    if (!existing || key < existing) examBySubject.set(a.subjectId, key);
  }

  for (const item of recommendation.subjectPriorities) {
    allocations.push({
      subjectId: item.subjectId,
      topicId: item.topicIds[0] ?? null,
      priority: item.priority,
      suggestedMinutes: item.suggestedMinutes,
      reason: item.reasoning,
      kind: "study",
      beforeDate: examBySubject.get(item.subjectId) ?? null,
    });
  }

  if (context.includeRevision) {
    for (const item of recommendation.revisionTopics) {
      allocations.push({
        subjectId: item.subjectId,
        topicId: item.topicId ?? null,
        priority: 70,
        suggestedMinutes: item.suggestedMinutes,
        reason: item.reason,
        kind: "revision",
        beforeDate: examBySubject.get(item.subjectId) ?? null,
      });
    }
  }

  return allocations;
}
