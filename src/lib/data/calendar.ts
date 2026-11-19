import "server-only";

import { cache } from "react";

import { getSessionUser } from "@/lib/auth";
import { fetchAllPages, overlapOrFilter, type PagedResult } from "@/lib/data/paged-query";
import { getGamificationPreferences } from "@/lib/data/progress";
import { createClient } from "@/lib/supabase/server";
import { dayBoundsIso } from "@/lib/task-due";
import { addLocalDays, localDateKey } from "@/lib/progress/timezone";
import type {
  Assessment,
  CalendarEvent,
  StudySession,
  Subtask,
  Task,
} from "@/types/database";

async function loadPages<T>(
  label: string,
  loadPage: Parameters<typeof fetchAllPages<T>>[0],
): Promise<PagedResult<T>> {
  const result = await fetchAllPages(loadPage);
  if (result.error) console.error(`${label}:`, result.error);
  return result;
}

export const listAssessments = cache(async (): Promise<Assessment[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await loadPages<Assessment>("listAssessments", (from, to) =>
    supabase
      .from("assessments")
      .select("*")
      .eq("user_id", user.id)
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data;
});

export const listAssessmentsInRange = cache(
  async (startIso: string, endIso: string): Promise<PagedResult<Assessment>> => {
    const user = await getSessionUser();
    if (!user) return { data: [], error: null };
    const supabase = await createClient();
    return loadPages<Assessment>("listAssessmentsInRange", (from, to) =>
      supabase
        .from("assessments")
        .select("*")
        .eq("user_id", user.id)
        .or(overlapOrFilter(startIso, endIso))
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
  },
);

export const listAssessmentsForSubject = cache(
  async (subjectId: string): Promise<Assessment[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data } = await loadPages<Assessment>("listAssessmentsForSubject", (from, to) =>
      supabase
        .from("assessments")
        .select("*")
        .eq("user_id", user.id)
        .eq("subject_id", subjectId)
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    return data;
  },
);

export const listUpcomingAssessments = cache(async (limit = 8) => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("user_id", user.id)
    .eq("completed", false)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("listUpcomingAssessments:", error.message);
    return [];
  }
  return data ?? [];
});

export const listCalendarEvents = cache(async (): Promise<CalendarEvent[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await loadPages<CalendarEvent>("listCalendarEvents", (from, to) =>
    supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data;
});

export const listCalendarEventsInRange = cache(
  async (startIso: string, endIso: string): Promise<PagedResult<CalendarEvent>> => {
    const user = await getSessionUser();
    if (!user) return { data: [], error: null };
    const supabase = await createClient();
    return loadPages<CalendarEvent>("listCalendarEventsInRange", (from, to) =>
      supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .or(overlapOrFilter(startIso, endIso))
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
  },
);

export const listStudySessions = cache(async (): Promise<StudySession[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await loadPages<StudySession>("listStudySessions", (from, to) =>
    supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["planned", "completed"])
      .not("ends_at", "is", null)
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data;
});

export const listStudySessionsInRange = cache(
  async (
    startIso: string,
    endIso: string,
    statuses: StudySession["status"][] = ["planned", "completed"],
  ): Promise<PagedResult<StudySession>> => {
    const user = await getSessionUser();
    if (!user) return { data: [], error: null };
    const supabase = await createClient();
    return loadPages<StudySession>("listStudySessionsInRange", (from, to) =>
      supabase
        .from("study_sessions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", statuses)
        .not("ends_at", "is", null)
        .or(overlapOrFilter(startIso, endIso))
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
  },
);

export const listUpcomingStudySessions = cache(async (limit = 6) => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "planned")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("listUpcomingStudySessions:", error.message);
    return [];
  }
  return data ?? [];
});

export const listTasks = cache(async (): Promise<Task[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await loadPages<Task>("listTasks", (from, to) =>
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data;
});

/** Open tasks for the calendar linker and chips. Paged so the row cap cannot hide one. */
export const listOpenTasks = cache(async (): Promise<PagedResult<Task>> => {
  const user = await getSessionUser();
  if (!user) return { data: [], error: null };
  const supabase = await createClient();
  return loadPages<Task>("listOpenTasks", (from, to) =>
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "todo")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
});

export const listScheduledTasksInRange = cache(
  async (startIso: string, endIso: string): Promise<PagedResult<Task>> => {
    const user = await getSessionUser();
    if (!user) return { data: [], error: null };
    const supabase = await createClient();
    return loadPages<Task>("listScheduledTasksInRange", (from, to) =>
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "todo")
        .not("scheduled_start", "is", null)
        .not("scheduled_end", "is", null)
        .lt("scheduled_start", endIso)
        .gt("scheduled_end", startIso)
        .order("scheduled_start", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
  },
);

export const listSubtasksForTasks = cache(
  async (taskIds: string[]): Promise<Subtask[]> => {
    if (taskIds.length === 0) return [];
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data } = await loadPages<Subtask>("listSubtasksForTasks", (from, to) =>
      supabase
        .from("subtasks")
        .select("*")
        .eq("user_id", user.id)
        .in("task_id", taskIds)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    return data;
  },
);

export async function getDashboardAgenda() {
  const user = await getSessionUser();
  if (!user) {
    return {
      todayTasks: [] as Task[],
      overdueTasks: [] as Task[],
      upcomingAssessments: [] as Assessment[],
      upcomingSessions: [] as StudySession[],
      weekAssessments: [] as Assessment[],
      weekSessions: [] as StudySession[],
      weekEvents: [] as CalendarEvent[],
    };
  }

  const prefs = await getGamificationPreferences();
  const timeZone = prefs.timezone || "UTC";
  const now = new Date();
  const todayKey = localDateKey(now, timeZone);
  const { start: todayStart, endExclusive: tomorrowStart } = dayBoundsIso(
    todayKey,
    timeZone,
  );
  const weekEndKey = addLocalDays(todayKey, 7);
  const { endExclusive: weekEnd } = dayBoundsIso(weekEndKey, timeZone);

  const supabase = await createClient();

  const [
    todayTasksRes,
    overdueRes,
    upcomingAssessments,
    upcomingSessions,
    weekAssessmentsRes,
    weekSessionsRes,
    weekEventsRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "todo")
      .gte("due_at", todayStart)
      .lt("due_at", tomorrowStart)
      .order("priority", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "todo")
      .lt("due_at", todayStart)
      .order("due_at", { ascending: true }),
    listUpcomingAssessments(5),
    listUpcomingStudySessions(5),
    loadPages<Assessment>("dashboardWeekAssessments", (from, to) =>
      supabase
        .from("assessments")
        .select("*")
        .eq("user_id", user.id)
        .or(overlapOrFilter(todayStart, weekEnd))
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadPages<StudySession>("dashboardWeekSessions", (from, to) =>
      supabase
        .from("study_sessions")
        .select("*")
        .eq("user_id", user.id)
        .or(overlapOrFilter(todayStart, weekEnd))
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadPages<CalendarEvent>("dashboardWeekEvents", (from, to) =>
      supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .or(overlapOrFilter(todayStart, weekEnd))
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  if (todayTasksRes.error) console.error("dashboardTodayTasks:", todayTasksRes.error.message);
  if (overdueRes.error) console.error("dashboardOverdueTasks:", overdueRes.error.message);

  return {
    todayTasks: todayTasksRes.data ?? [],
    overdueTasks: overdueRes.data ?? [],
    upcomingAssessments,
    upcomingSessions,
    weekAssessments: weekAssessmentsRes.data,
    weekSessions: weekSessionsRes.data,
    weekEvents: weekEventsRes.data,
  };
}
