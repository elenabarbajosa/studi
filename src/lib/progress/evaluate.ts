import "server-only";

import {
  eligibleAchievements,
  newlyUnlocked,
  type AchievementId,
} from "@/lib/progress/achievements";
import {
  computeStreaks,
  type FocusSessionSlice,
} from "@/lib/progress/streaks";
import { defaultTodayKey } from "@/lib/progress/streaks";
import type { GamificationPreferences } from "@/lib/progress/types";
import { createClient } from "@/lib/supabase/server";
import type { Weekday } from "@/lib/subjects";

/**
 * Evaluate and award newly unlocked achievements for the current user.
 * Never throws to callers — failures are logged so session saves stay intact.
 */
export async function evaluateAndAwardAchievements(
  userId: string,
  prefs: Pick<
    GamificationPreferences,
    "timezone" | "min_daily_focus_minutes" | "rest_days" | "enabled"
  >,
): Promise<AchievementId[]> {
  if (!prefs.enabled) return [];

  try {
    const supabase = await createClient();

    const [
      sessionsRes,
      unlockedRes,
      friendsRes,
      roomsRes,
      challengesRes,
    ] = await Promise.all([
      supabase
        .from("study_sessions")
        .select(
          "starts_at, ends_at, focus_seconds, status, source, pomodoro_cycles",
        )
        .eq("user_id", userId)
        .in("source", ["focus", "study_together"])
        .eq("status", "completed"),
      supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", userId),
      supabase.rpc("list_my_friends"),
      supabase
        .from("study_room_members")
        .select("room_id")
        .eq("user_id", userId)
        .limit(1),
      supabase
        .from("challenge_participants")
        .select("challenge_id")
        .eq("user_id", userId)
        .eq("status", "completed"),
    ]);

    const sessions = (sessionsRes.data ?? []) as (FocusSessionSlice & {
      pomodoro_cycles?: number;
    })[];
    const streak = computeStreaks(sessions, {
      timeZone: prefs.timezone,
      minDailyFocusSeconds: prefs.min_daily_focus_minutes * 60,
      restDays: prefs.rest_days as Weekday[],
      consistencyDaysPerWeek: null,
      todayKey: defaultTodayKey(prefs.timezone),
    });

    const totalFocusSeconds = sessions.reduce(
      (sum, s) => sum + (s.focus_seconds ?? 0),
      0,
    );
    const maxPomodoroCycles = sessions.reduce(
      (max, s) => Math.max(max, s.pomodoro_cycles ?? 0),
      0,
    );
    const collabSessions = sessions.filter(
      (s) => s.source === "study_together",
    ).length;

    const eligible = eligibleAchievements({
      completedSessions: sessions.length,
      totalFocusSeconds,
      maxPomodoroCycles,
      longestStreak: streak.longestStreak,
      friendCount: friendsRes.data?.length ?? 0,
      studyRoomMemberships: roomsRes.data?.length ?? 0,
      collabSessions,
      challengesCompleted: challengesRes.data?.length ?? 0,
    });

    const unlocked = newlyUnlocked(
      eligible,
      (unlockedRes.data ?? []).map((r) => r.achievement_id),
    );

    for (const id of unlocked) {
      const { error } = await supabase.rpc("award_achievement", {
        p_user_id: userId,
        p_achievement_id: id,
      });
      if (error) console.error("award_achievement:", id, error.message);
    }

    return unlocked;
  } catch (err) {
    console.error("evaluateAndAwardAchievements failed:", err);
    return [];
  }
}
