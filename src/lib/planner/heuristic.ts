import { intensityMultiplier } from "@/lib/planner/schedule";
import type { AiPlanRecommendation } from "@/lib/planner/schemas";
import type { PlanIntensity, SubjectAllocation } from "@/lib/planner/types";

export type PlannerContextSnapshot = {
  timeZone: string;
  periodStart: string;
  periodEnd: string;
  intensity: PlanIntensity;
  includeRevision: boolean;
  subjects: {
    id: string;
    name: string;
    difficulty: number | null;
    unmasteredTopics: { id: string; title: string; status: string }[];
  }[];
  assessments: {
    id: string;
    subjectId: string | null;
    title: string;
    type: string;
    startsAt: string;
    daysUntil: number | null;
  }[];
  incompleteTasks: {
    id: string;
    subjectId: string | null;
    topicId: string | null;
    title: string;
    priority: string;
    dueAt: string | null;
  }[];
  recentFocusMinutesBySubject: Record<string, number>;
};

export function buildHeuristicAllocations(
  context: PlannerContextSnapshot,
): { allocations: SubjectAllocation[]; recommendation: AiPlanRecommendation } {
  const days =
    Math.max(
      1,
      Math.round(
        (new Date(`${context.periodEnd}T12:00:00Z`).getTime() -
          new Date(`${context.periodStart}T12:00:00Z`).getTime()) /
          86_400_000,
      ) + 1,
    );
  const mult = intensityMultiplier(context.intensity);
  const allocations: SubjectAllocation[] = [];
  const subjectPriorities: AiPlanRecommendation["subjectPriorities"] = [];
  const practiceNeeded: AiPlanRecommendation["practiceNeeded"] = [];
  const revisionTopics: AiPlanRecommendation["revisionTopics"] = [];
  const warnings: string[] = [];

  for (const subject of context.subjects) {
    const exam = context.assessments
      .filter((a) => a.subjectId === subject.id)
      .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999))[0];

    const openTopics = subject.unmasteredTopics;
    if (openTopics.length === 0 && !exam) continue;

    const difficulty = subject.difficulty ?? 3;
    let priority = 40 + difficulty * 8;
    if (exam?.daysUntil != null) {
      if (exam.daysUntil <= 7) priority += 35;
      else if (exam.daysUntil <= 14) priority += 20;
      else priority += 8;
    }
    const recent = context.recentFocusMinutesBySubject[subject.id] ?? 0;
    if (recent < 30) priority += 5;

    const baseMinutes = Math.round(
      (25 + openTopics.length * 20 + difficulty * 15) * mult * Math.min(days / 7, 3),
    );
    const suggestedMinutes = Math.min(2400, Math.max(50, baseMinutes));
    const topTopic = openTopics[0] ?? null;

    subjectPriorities.push({
      subjectId: subject.id,
      priority,
      reasoning: exam
        ? `${exam.title} in ${exam.daysUntil ?? "?"}d · ${openTopics.length} open topics`
        : `${openTopics.length} open topics · difficulty ${difficulty}/5`,
      suggestedMinutes,
      topicIds: openTopics.slice(0, 3).map((t) => t.id),
    });

    allocations.push({
      subjectId: subject.id,
      topicId: topTopic?.id ?? null,
      priority,
      suggestedMinutes,
      reason: subjectPriorities[subjectPriorities.length - 1]!.reasoning,
      kind: "study",
      beforeDate: exam?.startsAt ? exam.startsAt.slice(0, 10) : null,
    });

    for (const topic of openTopics.filter((t) => t.status === "practicing").slice(0, 2)) {
      practiceNeeded.push({
        subjectId: subject.id,
        topicId: topic.id,
        message: `"${topic.title}" is in practice — keep repeating before new material.`,
      });
    }

    if (context.includeRevision && exam && (exam.daysUntil ?? 99) <= 21) {
      const revMinutes = Math.round(40 * mult);
      revisionTopics.push({
        subjectId: subject.id,
        topicId: topTopic?.id ?? null,
        suggestedMinutes: revMinutes,
        reason: `Revision before ${exam.title}`,
      });
      allocations.push({
        subjectId: subject.id,
        topicId: topTopic?.id ?? null,
        priority: priority + 5,
        suggestedMinutes: revMinutes,
        reason: `Revision before ${exam.title}`,
        kind: "revision",
        beforeDate: exam.startsAt.slice(0, 10),
      });
    }
  }

  for (const task of context.incompleteTasks.slice(0, 12)) {
    if (!task.subjectId) continue;
    const existing = allocations.find(
      (a) => a.subjectId === task.subjectId && a.kind === "study",
    );
    if (existing) {
      existing.suggestedMinutes +=
        task.priority === "critical" || task.priority === "high" ? 40 : 25;
      existing.priority += task.priority === "critical" ? 10 : 4;
    }
  }

  if (context.subjects.length === 0) {
    warnings.push("No subjects available to plan. Add a subject first.");
  }
  if (context.assessments.length === 0) {
    warnings.push("No upcoming exams found — priorities are based on topic progress only.");
  }

  const recommendation: AiPlanRecommendation = {
    summary:
      subjectPriorities.length > 0
        ? `Focus on ${subjectPriorities
            .slice()
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 2)
            .map((s) => context.subjects.find((x) => x.id === s.subjectId)?.name ?? "subject")
            .join(" and ")} over the next ${days} days.`
        : "Not enough academic data to recommend a plan yet.",
    subjectPriorities,
    revisionTopics,
    workloadWarnings: warnings,
    practiceNeeded,
  };

  return { allocations, recommendation };
}
