import "server-only";

import { daysUntil } from "@/lib/dashboard";
import {
  listAssessments,
  listCalendarEvents,
  listStudySessions,
  listTasks,
} from "@/lib/data/calendar";
import { listCompletedFocusSessions } from "@/lib/data/focus";
import { getGamificationPreferences } from "@/lib/data/progress";
import { getStudyPreferences, listAllTopics, listSubjects } from "@/lib/data/subjects";
import type { PlannerContextSnapshot } from "@/lib/planner/heuristic";
import type { PlannerPreferencesInput } from "@/lib/planner/schemas";
import {
  DEFAULT_PLANNER_TIME_WINDOWS,
  type PlanIntensity,
  type PlanningPeriod,
  type BusyInterval,
} from "@/lib/planner/types";
import {
  addLocalDays,
  localDateKey,
  startOfLocalWeekKey,
} from "@/lib/progress/timezone";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_WEEKDAY_AVAILABILITY,
  type Weekday,
  type WeekdayAvailability,
} from "@/lib/subjects";
import type { PlannerPreferences, StudyPlan, StudySession } from "@/types/database";

export type PlannerDashboardData = {
  timeZone: string;
  preferences: PlannerPreferencesInput;
  studyPreferences: Awaited<ReturnType<typeof getStudyPreferences>>;
  subjects: Awaited<ReturnType<typeof listSubjects>>;
  topics: Awaited<ReturnType<typeof listAllTopics>>;
  assessments: Awaited<ReturnType<typeof listAssessments>>;
  tasks: Awaited<ReturnType<typeof listTasks>>;
  studySessions: StudySession[];
  activePlan: StudyPlan | null;
  planSessions: {
    link: { id: string; study_session_id: string; locked: boolean; user_edited: boolean };
    session: StudySession;
  }[];
  busy: BusyInterval[];
  context: PlannerContextSnapshot;
  plannedMinutesThisWeek: number;
  completedFocusMinutesThisWeek: number;
};

export function defaultPrefsFromStudy(
  study: Awaited<ReturnType<typeof getStudyPreferences>>,
): PlannerPreferencesInput {
  const availability = (study?.weekday_availability ??
    DEFAULT_WEEKDAY_AVAILABILITY) as WeekdayAvailability;
  const windows = structuredClone(DEFAULT_PLANNER_TIME_WINDOWS);
  for (const day of Object.keys(windows) as Weekday[]) {
    if (!availability[day]) windows[day] = [];
  }
  return {
    planning_period: "14",
    intensity: "balanced",
    max_hours_per_day: 4,
    preferred_session_minutes: study?.session_duration_minutes ?? 50,
    break_minutes: study?.break_duration_minutes ?? 10,
    include_revision: true,
    include_incomplete_tasks: true,
    weekday_availability: availability,
    time_windows: windows,
    rest_days: (Object.keys(availability) as Weekday[]).filter((d) => !availability[d]),
    included_subject_ids: null,
    prioritized_topic_ids: [],
    excluded_topic_ids: [],
    until_assessment_id: null,
  };
}

export function resolvePeriodBounds(
  prefs: PlannerPreferencesInput,
  timeZone: string,
  assessments: { id: string; starts_at: string }[],
  now = new Date(),
): { periodStart: string; periodEnd: string } {
  const periodStart = localDateKey(now, timeZone);
  if (prefs.planning_period === "until_exam" && prefs.until_assessment_id) {
    const exam = assessments.find((a) => a.id === prefs.until_assessment_id);
    if (exam) {
      const end = localDateKey(exam.starts_at, timeZone);
      if (end >= periodStart) return { periodStart, periodEnd: end };
    }
  }
  const span =
    prefs.planning_period === "7" ? 6 : prefs.planning_period === "30" ? 29 : 13;
  return { periodStart, periodEnd: addLocalDays(periodStart, span) };
}

export async function getPlannerPreferences(
  userId: string,
): Promise<PlannerPreferences | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planner_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as PlannerPreferences | null) ?? null;
}

export async function getActiveStudyPlan(userId: string): Promise<StudyPlan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("study_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as StudyPlan | null) ?? null;
}

export async function loadPlannerDashboard(userId: string): Promise<PlannerDashboardData> {
  const [
    subjects,
    topics,
    assessments,
    tasks,
    studySessions,
    studyPrefs,
    gamification,
    storedPrefs,
    recentFocus,
    calendarEvents,
  ] = await Promise.all([
    listSubjects(),
    listAllTopics(),
    listAssessments(),
    listTasks(),
    listStudySessions(),
    getStudyPreferences(),
    getGamificationPreferences(),
    getPlannerPreferences(userId),
    listCompletedFocusSessions(80),
    listCalendarEvents(),
  ]);

  const timeZone = gamification.timezone || "UTC";
  const defaults = defaultPrefsFromStudy(studyPrefs);
  const preferences: PlannerPreferencesInput = storedPrefs
    ? {
        planning_period: storedPrefs.planning_period as PlanningPeriod,
        intensity: storedPrefs.intensity as PlanIntensity,
        max_hours_per_day: Number(storedPrefs.max_hours_per_day),
        preferred_session_minutes: storedPrefs.preferred_session_minutes,
        break_minutes: storedPrefs.break_minutes,
        include_revision: storedPrefs.include_revision,
        include_incomplete_tasks: storedPrefs.include_incomplete_tasks,
        weekday_availability: storedPrefs.weekday_availability,
        time_windows: storedPrefs.time_windows,
        rest_days: storedPrefs.rest_days as Weekday[],
        included_subject_ids: storedPrefs.included_subject_ids,
        prioritized_topic_ids: storedPrefs.prioritized_topic_ids,
        excluded_topic_ids: storedPrefs.excluded_topic_ids,
        until_assessment_id: storedPrefs.until_assessment_id,
      }
    : defaults;

  const activePlan = await getActiveStudyPlan(userId);
  let planSessions: PlannerDashboardData["planSessions"] = [];
  if (activePlan) {
    const supabase = await createClient();
    const { data: links } = await supabase
      .from("study_plan_sessions")
      .select("*")
      .eq("plan_id", activePlan.id)
      .eq("user_id", userId);
    const byId = new Map(studySessions.map((s) => [s.id, s]));
    planSessions = (links ?? [])
      .map((link) => {
        const session = byId.get(link.study_session_id);
        if (!session) return null;
        return {
          link: {
            id: link.id,
            study_session_id: link.study_session_id,
            locked: link.locked,
            user_edited: link.user_edited,
          },
          session,
        };
      })
      .filter(Boolean) as PlannerDashboardData["planSessions"];
  }

  const now = new Date();
  const todayKey = localDateKey(now, timeZone);
  const weekStart = startOfLocalWeekKey(todayKey, timeZone);
  const weekEnd = addLocalDays(weekStart, 6);
  const bounds = resolvePeriodBounds(preferences, timeZone, assessments, now);

  const busy: BusyInterval[] = [
    ...studySessions
      .filter((s) => s.ends_at && (s.status === "planned" || s.status === "in_progress"))
      .map((s) => ({
        startsAt: s.starts_at,
        endsAt: s.ends_at!,
        label: "Study session",
      })),
    ...assessments
      .filter((a) => !a.completed)
      .map((a) => ({
        startsAt: a.starts_at,
        endsAt: a.ends_at ?? a.starts_at,
        label: a.title,
      })),
    ...calendarEvents.map((e) => ({
      startsAt: e.starts_at,
      endsAt: e.ends_at ?? e.starts_at,
      label: e.title,
    })),
    ...tasks
      .filter((t) => t.status === "todo" && t.scheduled_start && t.scheduled_end)
      .map((t) => ({
        startsAt: t.scheduled_start!,
        endsAt: t.scheduled_end!,
        label: t.title,
      })),
  ];

  const included = preferences.included_subject_ids;
  const excludedTopics = new Set(preferences.excluded_topic_ids);
  const filteredSubjects = subjects.filter(
    (s) => !included || included.length === 0 || included.includes(s.id),
  );

  const recentFocusMinutesBySubject: Record<string, number> = {};
  for (const session of recentFocus) {
    if (!session.subject_id) continue;
    recentFocusMinutesBySubject[session.subject_id] =
      (recentFocusMinutesBySubject[session.subject_id] ?? 0) +
      Math.round((session.focus_seconds ?? 0) / 60);
  }

  const context: PlannerContextSnapshot = {
    timeZone,
    periodStart: bounds.periodStart,
    periodEnd: bounds.periodEnd,
    intensity: preferences.intensity,
    includeRevision: preferences.include_revision,
    subjects: filteredSubjects.map((s) => ({
      id: s.id,
      name: s.name,
      difficulty: s.difficulty,
      unmasteredTopics: topics
        .filter(
          (t) =>
            t.subject_id === s.id &&
            t.status !== "mastered" &&
            !excludedTopics.has(t.id) &&
            t.parent_id === null,
        )
        .map((t) => ({ id: t.id, title: t.title, status: t.status })),
    })),
    assessments: assessments
      .filter((a) => !a.completed && daysUntil(a.starts_at, now) >= 0)
      .map((a) => ({
        id: a.id,
        subjectId: a.subject_id,
        title: a.title,
        type: a.assessment_type,
        startsAt: a.starts_at,
        daysUntil: daysUntil(a.starts_at, now),
      })),
    incompleteTasks: (preferences.include_incomplete_tasks
      ? tasks.filter((t) => t.status === "todo")
      : []
    ).map((t) => ({
      id: t.id,
      subjectId: t.subject_id,
      topicId: t.topic_id,
      title: t.title,
      priority: t.priority,
      dueAt: t.due_at,
    })),
    recentFocusMinutesBySubject,
  };

  const plannedMinutesThisWeek = studySessions
    .filter((s) => {
      if (s.status !== "planned" || !s.ends_at) return false;
      const key = localDateKey(s.starts_at, timeZone);
      return key >= weekStart && key <= weekEnd;
    })
    .reduce((sum, s) => sum + (s.planned_duration_minutes ?? 0), 0);

  const completedFocusMinutesThisWeek = recentFocus
    .filter((s) => {
      const key = localDateKey(s.starts_at, timeZone);
      return key >= weekStart && key <= weekEnd;
    })
    .reduce((sum, s) => sum + Math.round((s.focus_seconds ?? 0) / 60), 0);

  return {
    timeZone,
    preferences,
    studyPreferences: studyPrefs,
    subjects,
    topics,
    assessments,
    tasks,
    studySessions,
    activePlan,
    planSessions,
    busy,
    context,
    plannedMinutesThisWeek,
    completedFocusMinutesThisWeek,
  };
}
