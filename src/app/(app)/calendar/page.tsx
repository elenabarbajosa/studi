import { Suspense } from "react";

import { CalendarBoard } from "@/components/calendar/calendar-board";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
import { requireProfile } from "@/lib/auth";
import { detectExternalPlanConflicts } from "@/lib/calendar-sync/busy";
import { filterBlockingExternalEvents } from "@/lib/calendar-sync/calendar-settings";
import { queryWindowForRange, resolveRequestedRange } from "@/lib/calendar-range";
import {
  listAssessmentsInRange,
  listCalendarEventsInRange,
  listOpenTasks,
  listStudySessionsInRange,
} from "@/lib/data/calendar";
import {
  getCalendarIntegrationStatus,
  listExternalCalendarEventsInRange,
  listExternalCalendars,
  listExternalConnections,
} from "@/lib/data/external-calendar";
import { getGamificationPreferences } from "@/lib/data/progress";
import { listAllTopics, listSubjects } from "@/lib/data/subjects";

export const metadata = { title: "Calendar" };

async function CalendarContent({
  connectResult,
  connectMessage,
  from,
  to,
}: {
  connectResult: string | null;
  connectMessage: string | null;
  from: string | null;
  to: string | null;
}) {
  await requireProfile();
  const timeZone = (await getGamificationPreferences()).timezone || "UTC";
  const loadedRange = resolveRequestedRange(from, to, new Date(), timeZone);
  const window = queryWindowForRange(loadedRange, timeZone);
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
    listAssessmentsInRange(window.startIso, window.endIso),
    listCalendarEventsInRange(window.startIso, window.endIso),
    listStudySessionsInRange(window.startIso, window.endIso),
    listSubjects(),
    listAllTopics(),
    listOpenTasks(),
    listExternalCalendarEventsInRange(window.startIso, window.endIso),
    listExternalCalendars(),
    listExternalConnections(),
    getCalendarIntegrationStatus(),
  ]);

  const loadError = [
    assessments.error ? "exams and deadlines" : null,
    personalEvents.error ? "personal events" : null,
    studySessions.error ? "study sessions" : null,
    tasks.error ? "tasks" : null,
    externalEvents.error ? "connected calendars" : null,
  ]
    .filter((label): label is string => Boolean(label))
    .join(", ");

  const planConflicts = detectExternalPlanConflicts(
    studySessions.data,
    filterBlockingExternalEvents(externalEvents.data, externalCalendars),
  );

  const syncStale = externalConnections.some(
    (c) =>
      c.status === "error" ||
      c.status === "needs_reauth" ||
      Boolean(c.last_sync_error),
  );

  return (
    <CalendarBoard
      assessments={assessments.data}
      personalEvents={personalEvents.data}
      studySessions={studySessions.data}
      subjects={subjects}
      topics={topics}
      tasks={tasks.data}
      externalEvents={externalEvents.data}
      loadedRange={loadedRange}
      loadError={
        loadError
          ? `Some calendar data couldn't be loaded (${loadError}). Refresh to try again.`
          : null
      }
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
  const from = typeof params.from === "string" ? params.from : null;
  const to = typeof params.to === "string" ? params.to : null;

  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarContent
        connectResult={connectResult}
        connectMessage={connectMessage}
        from={from}
        to={to}
      />
    </Suspense>
  );
}
