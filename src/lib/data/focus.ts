import "server-only";

import { cache } from "react";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FocusActiveSession, StudySession } from "@/types/database";

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfLocalWeek(d = new Date()) {
  const x = startOfLocalDay(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  return x;
}

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
  const todayStart = startOfLocalDay().toISOString();
  const weekStart = startOfLocalWeek().toISOString();
  const historyStart = new Date();
  historyStart.setDate(historyStart.getDate() - 27);
  historyStart.setHours(0, 0, 0, 0);

  const [sessionsRes, prefsRes] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("focus_seconds, subject_id, starts_at")
      .eq("user_id", user.id)
      .in("source", ["focus", "study_together"])
      .eq("status", "completed")
      .gte("starts_at", historyStart.toISOString())
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
    .filter((s) => s.starts_at >= todayStart)
    .reduce((sum, s) => sum + (s.focus_seconds ?? 0), 0);
  const weekSec = sessions
    .filter((s) => s.starts_at >= weekStart)
    .reduce((sum, s) => sum + (s.focus_seconds ?? 0), 0);
  const totalSec = sessions.reduce((sum, s) => sum + (s.focus_seconds ?? 0), 0);
  const count = sessions.length;

  const bySubjectMap = new Map<string | null, number>();
  for (const s of sessions) {
    const key = s.subject_id;
    bySubjectMap.set(key, (bySubjectMap.get(key) ?? 0) + (s.focus_seconds ?? 0));
  }

  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 28; i++) {
    const d = new Date(historyStart);
    d.setDate(historyStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }
  for (const s of sessions) {
    const key = new Date(s.starts_at).toISOString().slice(0, 10);
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + (s.focus_seconds ?? 0));
    }
  }

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
    daily: [...dailyMap.entries()].map(([date, seconds]) => ({ date, seconds })),
    weeklyGoalHours,
    weekGoalProgress,
  };
});

export async function getTodayFocusSeconds() {
  const stats = await getFocusStats();
  return stats.todaySeconds;
}
