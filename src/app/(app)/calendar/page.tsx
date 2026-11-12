import { Suspense } from "react";

import { CalendarBoard } from "@/components/calendar/calendar-board";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import {
  listAssessments,
  listCalendarEvents,
  listStudySessions,
  listTasks,
} from "@/lib/data/calendar";
import { listAllTopics, listSubjects } from "@/lib/data/subjects";

export const metadata = { title: "Calendar" };

async function CalendarContent() {
  await requireProfile();
  const [
    assessments,
    personalEvents,
    studySessions,
    subjects,
    topics,
    tasks,
  ] = await Promise.all([
    listAssessments(),
    listCalendarEvents(),
    listStudySessions(),
    listSubjects(),
    listAllTopics(),
    listTasks(),
  ]);

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Exams, deadlines, personal events, and study sessions in one place."
      />
      <CalendarBoard
        assessments={assessments}
        personalEvents={personalEvents}
        studySessions={studySessions}
        subjects={subjects}
        topics={topics}
        tasks={tasks}
      />
    </div>
  );
}

function CalendarFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-[32rem] w-full rounded-2xl" />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarFallback />}>
      <CalendarContent />
    </Suspense>
  );
}
