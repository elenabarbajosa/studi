import "server-only";

import { cache } from "react";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Assessment,
  CalendarEvent,
  StudySession,
  Subtask,
  Task,
} from "@/types/database";

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export const listAssessments = cache(async (): Promise<Assessment[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true });
  if (error) {
    console.error("listAssessments:", error.message);
    return [];
  }
  return data ?? [];
});

export const listAssessmentsForSubject = cache(
  async (subjectId: string): Promise<Assessment[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assessments")
      .select("*")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)
      .order("starts_at", { ascending: true });
    if (error) {
      console.error("listAssessmentsForSubject:", error.message);
      return [];
    }
    return data ?? [];
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
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true });
  if (error) {
    console.error("listCalendarEvents:", error.message);
    return [];
  }
  return data ?? [];
});

export const listStudySessions = cache(async (): Promise<StudySession[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true });
  if (error) {
    console.error("listStudySessions:", error.message);
    return [];
  }
  return data ?? [];
});

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
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listTasks:", error.message);
    return [];
  }
  return data ?? [];
});

export const listSubtasksForTasks = cache(
  async (taskIds: string[]): Promise<Subtask[]> => {
    if (taskIds.length === 0) return [];
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("subtasks")
      .select("*")
      .eq("user_id", user.id)
      .in("task_id", taskIds)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("listSubtasksForTasks:", error.message);
      return [];
    }
    return data ?? [];
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

  const now = new Date();
  const todayStart = startOfLocalDay(now).toISOString();
  const todayEnd = endOfLocalDay(now).toISOString();
  const weekEnd = endOfLocalDay(
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  ).toISOString();

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
      .lte("due_at", todayEnd)
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
    supabase
      .from("assessments")
      .select("*")
      .eq("user_id", user.id)
      .gte("starts_at", todayStart)
      .lte("starts_at", weekEnd)
      .order("starts_at", { ascending: true }),
    supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", user.id)
      .gte("starts_at", todayStart)
      .lte("starts_at", weekEnd)
      .order("starts_at", { ascending: true }),
    supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .gte("starts_at", todayStart)
      .lte("starts_at", weekEnd)
      .order("starts_at", { ascending: true }),
  ]);

  return {
    todayTasks: todayTasksRes.data ?? [],
    overdueTasks: overdueRes.data ?? [],
    upcomingAssessments,
    upcomingSessions,
    weekAssessments: weekAssessmentsRes.data ?? [],
    weekSessions: weekSessionsRes.data ?? [],
    weekEvents: weekEventsRes.data ?? [],
  };
}
