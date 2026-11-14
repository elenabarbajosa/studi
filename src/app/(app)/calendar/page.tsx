import { Suspense } from "react";

import { CalendarBoard } from "@/components/calendar/calendar-board";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
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
    <CalendarBoard
      assessments={assessments}
      personalEvents={personalEvents}
      studySessions={studySessions}
      subjects={subjects}
      topics={topics}
      tasks={tasks}
    />
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarContent />
    </Suspense>
  );
}
