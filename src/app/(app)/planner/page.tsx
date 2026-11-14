import { Suspense } from "react";

import { PlannerBoard } from "@/components/planner/planner-board";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveAiDailyLimit } from "@/lib/ai/limits";
import { requireProfile } from "@/lib/auth";
import { loadPlannerDashboard } from "@/lib/planner/context";

export const metadata = { title: "Study Planner" };

async function PlannerContent() {
  const { profile } = await requireProfile();
  const data = await loadPlannerDashboard(profile.id);

  const recommendations = Array.isArray(data.activePlan?.recommendations)
    ? (data.activePlan?.recommendations as string[])
    : data.context.subjects.length > 0
      ? [
          "Generate a plan to get subject priorities grounded in your exams and topic progress.",
        ]
      : ["Add a subject before generating a study plan."];

  return (
    <PlannerBoard
      timeZone={data.timeZone}
      preferences={data.preferences}
      subjects={data.subjects}
      topics={data.topics}
      assessments={data.assessments}
      tasks={data.tasks}
      activePlan={data.activePlan}
      planSessions={data.planSessions}
      plannedMinutesThisWeek={data.plannedMinutesThisWeek}
      completedFocusMinutesThisWeek={data.completedFocusMinutesThisWeek}
      recommendations={recommendations}
      dailyAiLimit={resolveAiDailyLimit(profile.id)}
    />
  );
}

function PlannerFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full rounded-[24px]" />
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<PlannerFallback />}>
      <PlannerContent />
    </Suspense>
  );
}
