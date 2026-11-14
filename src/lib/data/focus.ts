import "server-only";

import { cache } from "react";

import { getSessionUser } from "@/lib/auth";
import { buildDailyFocusSeries } from "@/lib/focus/stats-days";
import { getGamificationPreferences } from "@/lib/data/progress";
import {
  addLocalDays,
  localDateKey,
  localMidnightIso,
  startOfLocalWeekKey,
} from "@/lib/progress/timezone";
import { createClient } from "@/lib/supabase/server";
import type { FocusActiveSession, StudySession } from "@/types/database";

export const getActiveFocusSession = cache(
  async (): Promise<FocusActiveSession | null> => {
    const user = await getSessionUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("focus_active_sessions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("getActiveFocusSession:", error.message);
      return null;
    }
    return data;
  },
);

export const listCompletedFocusSessions = cache(
  async (limit = 40): Promise<StudySession[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", user.id)
      .in("source", ["focus", "study_together"])
      .eq("status", "completed")
      .order("starts_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("listCompletedFocusSessions:", error.message);
      return [];
    }
    return data ?? [];
  },
);

export type FocusStats = {
  todaySeconds: number;
  weekSeconds: number;
  totalSeconds: number;
  sessionCount: number;
  averageSeconds: number;
  bySubject: { subjectId: string | null; seconds: number }[];
  daily: { date: string; seconds: number }[];
  weeklyGoalHours: number | null;
  weekGoalProgress: number | null;
};

export const getFocusStats = cache(async (): Promise<FocusStats> => {
  const empty: FocusStats = {
    todaySeconds: 0,
    weekSeconds: 0,
    totalSeconds: 0,
    sessionCount: 0,
    averageSeconds: 0,
    bySubject: [],
    daily: [],
    weeklyGoalHours: null,
    weekGoalProgress: null,
  };

  const user = await getSessionUser();
  if (!user) return empty;

  const supabase = await createClient();
  const gamification = await getGamificationPreferences();
  const timeZone = gamification.timezone || "UTC";
  const todayKey = localDateKey(new Date(), timeZone);
  const historyStartKey = addLocalDays(todayKey, -27);
  const weekStartKey = startOfLocalWeekKey(todayKey, timeZone);
  const historyStartIso = localMidnightIso(historyStartKey, timeZone);
  const todayStartIso = localMidnightIso(todayKey, timeZone);
  const weekStartIso = localMidnightIso(weekStartKey, timeZone);

  const [sessionsRes, prefsRes] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("focus_seconds, subject_id, starts_at")
      .eq("user_id", user.id)
      .in("source", ["focus", "study_together"])
      .eq("status", "completed")
      .gte("starts_at", historyStartIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("study_preferences")
      .select("weekly_goal_hours")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (sessionsRes.error) {
    console.error("getFocusStats:", sessionsRes.error.message);
    return empty;
  }

  const sessions = sessionsRes.data ?? [];
  const todaySec = sessions
    .filter((s) => s.starts_at >= todayStartIso)
    .reduce((sum, s) => sum + (s.focus_seconds ?? 0), 0);
  const weekSec = sessions
    .filter((s) => s.starts_at >= weekStartIso)
    .reduce((sum, s) => sum + (s.focus_seconds ?? 0), 0);
  const totalSec = sessions.reduce((sum, s) => sum + (s.focus_seconds ?? 0), 0);
  const count = sessions.length;

  const bySubjectMap = new Map<string | null, number>();
  for (const s of sessions) {
    const key = s.subject_id;
    bySubjectMap.set(key, (bySubjectMap.get(key) ?? 0) + (s.focus_seconds ?? 0));
  }

  const daily = buildDailyFocusSeries(sessions, {
    startKey: historyStartKey,
    dayCount: 28,
    timeZone,
  });

  const weeklyGoalHours = prefsRes.data?.weekly_goal_hours ?? null;
  const weekGoalProgress =
    weeklyGoalHours != null && weeklyGoalHours > 0
      ? Math.min(1, weekSec / (weeklyGoalHours * 3600))
      : null;

  return {
    todaySeconds: todaySec,
    weekSeconds: weekSec,
    totalSeconds: totalSec,
    sessionCount: count,
    averageSeconds: count === 0 ? 0 : Math.round(totalSec / count),
    bySubject: [...bySubjectMap.entries()]
      .map(([subjectId, seconds]) => ({ subjectId, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
    daily,
    weeklyGoalHours,
    weekGoalProgress,
  };
});

export async function getTodayFocusSeconds() {
  const stats = await getFocusStats();
  return stats.todaySeconds;
}
