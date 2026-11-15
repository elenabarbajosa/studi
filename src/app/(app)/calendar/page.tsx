import { Suspense } from "react";

import { CalendarBoard } from "@/components/calendar/calendar-board";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
import { requireProfile } from "@/lib/auth";
import { detectExternalPlanConflicts } from "@/lib/calendar-sync/busy";
import {
  listAssessments,
  listCalendarEvents,
  listStudySessions,
  listTasks,
} from "@/lib/data/calendar";
import {
  getCalendarIntegrationStatus,
  listExternalCalendarEvents,
  listExternalCalendars,
  listExternalConnections,
} from "@/lib/data/external-calendar";
import { listAllTopics, listSubjects } from "@/lib/data/subjects";

export const metadata = { title: "Calendar" };

async function CalendarContent({
  connectResult,
  connectMessage,
}: {
  connectResult: string | null;
  connectMessage: string | null;
}) {
  await requireProfile();
  const [
    assessments,
    personalEvents,
    studySessions,
    subjects,
    topics,
    tasks,
    externalEvents,
    externalCalendars,
    externalConnections,
    integrationStatus,
  ] = await Promise.all([
    listAssessments(),
    listCalendarEvents(),
    listStudySessions(),
    listSubjects(),
    listAllTopics(),
    listTasks(),
    listExternalCalendarEvents(),
    listExternalCalendars(),
    listExternalConnections(),
    getCalendarIntegrationStatus(),
  ]);

  const planConflicts = detectExternalPlanConflicts(
    studySessions,
    externalEvents,
  );

  const syncStale = externalConnections.some(
    (c) =>
      c.status === "error" ||
      c.status === "needs_reauth" ||
      Boolean(c.last_sync_error),
  );

  return (
    <CalendarBoard
      assessments={assessments}
      personalEvents={personalEvents}
      studySessions={studySessions}
      subjects={subjects}
      topics={topics}
      tasks={tasks}
      externalEvents={externalEvents}
      externalCalendars={externalCalendars}
      externalConnections={externalConnections}
      integrationStatus={integrationStatus}
      planConflicts={planConflicts}
      syncStale={syncStale}
      connectResult={connectResult}
      connectMessage={connectMessage}
    />
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const connectResult = typeof params.calendar_connect === "string"
    ? params.calendar_connect
    : null;
  const connectMessage =
    typeof params.message === "string" ? params.message : null;

  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarContent
        connectResult={connectResult}
        connectMessage={connectMessage}
      />
    </Suspense>
  );
}
