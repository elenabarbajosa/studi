import "server-only";

import { cache } from "react";

import { AVATAR_BUCKET, AVATAR_SIGNED_URL_TTL_SECONDS } from "@/lib/avatar";
import { getSessionUser } from "@/lib/auth";
import { ACHIEVEMENT_CATALOG } from "@/lib/progress/achievements";
import {
  computeChallengeProgress,
  type ChallengeType,
} from "@/lib/progress/challenges";
import { computeWeeklyGoal } from "@/lib/progress/goals";
import {
  computeStreaks,
  defaultTodayKey,
  type FocusSessionSlice,
} from "@/lib/progress/streaks";
import {
  endOfLocalWeekKey,
  localMidnightIso,
  startOfLocalWeekKey,
} from "@/lib/progress/timezone";
import {
  DEFAULT_GAMIFICATION_PREFS,
  type AchievementDefinition,
  type ChallengeInvitation,
  type GamificationPreferences,
  type StudyChallenge,
  type UserAchievement,
} from "@/lib/progress/types";
import { createClient } from "@/lib/supabase/server";
import type { Weekday } from "@/lib/subjects";
import type { AccentColor } from "@/lib/theme";
import type { AvatarPreference } from "@/types/database";

async function signAvatarPath(path: string | null | undefined) {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function parseRestDays(raw: unknown): Weekday[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  return raw.filter((d): d is Weekday => typeof d === "string" && allowed.has(d));
}

export const getGamificationPreferences = cache(
  async (): Promise<GamificationPreferences> => {
    const user = await getSessionUser();
    if (!user) {
      return { user_id: "", ...DEFAULT_GAMIFICATION_PREFS, created_at: "", updated_at: "" };
    }
    const supabase = await createClient();
    const { data } = await supabase
      .from("gamification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) {
      return {
        user_id: user.id,
        ...DEFAULT_GAMIFICATION_PREFS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return {
      ...data,
      rest_days: parseRestDays(data.rest_days),
    } as GamificationPreferences;
  },
);

export const listVerifiedFocusSessions = cache(
  async (): Promise<(FocusSessionSlice & { pomodoro_cycles: number })[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("study_sessions")
      .select("starts_at, ends_at, focus_seconds, status, source, pomodoro_cycles")
      .eq("user_id", user.id)
      .in("source", ["focus", "study_together"])
      .eq("status", "completed")
      .order("starts_at", { ascending: true });
    if (error) {
      console.error("listVerifiedFocusSessions:", error.message);
      return [];
    }
    return (data ?? []) as (FocusSessionSlice & { pomodoro_cycles: number })[];
  },
);

export const getProgressDashboard = cache(async () => {
  const user = await getSessionUser();
  const prefs = await getGamificationPreferences();
  const empty = {
    prefs,
    streak: null as ReturnType<typeof computeStreaks> | null,
    weekly: null as ReturnType<typeof computeWeeklyGoal> | null,
    achievements: [] as Array<
      AchievementDefinition & { unlocked: boolean; unlocked_at: string | null }
    >,
    recentUnlocks: [] as UserAchievement[],
    challenges: [] as Array<{
      challenge: StudyChallenge;
      progress: ReturnType<typeof computeChallengeProgress>;
      participantCount: number;
    }>,
    invitations: [] as Array<
      ChallengeInvitation & { challengeName: string }
    >,
    weeklyGoalHours: null as number | null,
  };

  if (!user || !prefs.enabled) return empty;

  const supabase = await createClient();
  const [sessions, studyPrefs, defs, unlocks, memberships, invites] =
    await Promise.all([
      listVerifiedFocusSessions(),
      supabase
        .from("study_preferences")
        .select("weekly_goal_hours")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("achievement_definitions").select("*").eq("active", true),
      supabase
        .from("user_achievements")
        .select("*")
        .eq("user_id", user.id)
        .order("unlocked_at", { ascending: false }),
      supabase
        .from("challenge_participants")
        .select("challenge_id, status")
        .eq("user_id", user.id)
        .in("status", ["active", "completed"]),
      supabase
        .from("challenge_invitations")
        .select("*")
        .eq("invitee_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString()),
    ]);

  const todayKey = defaultTodayKey(prefs.timezone);
  const streak = computeStreaks(sessions, {
    timeZone: prefs.timezone,
    minDailyFocusSeconds: prefs.min_daily_focus_minutes * 60,
    restDays: prefs.rest_days,
    consistencyDaysPerWeek: prefs.consistency_days_per_week,
    todayKey,
  });

  const weeklyGoalHours = studyPrefs.data?.weekly_goal_hours ?? null;
  const weekly = computeWeeklyGoal({
    sessions,
    timeZone: prefs.timezone,
    todayKey,
    weeklyGoalHours,
  });

  const unlockedMap = new Map(
    (unlocks.data ?? []).map((u) => [u.achievement_id, u as UserAchievement]),
  );
  const defRows = (defs.data ?? []) as AchievementDefinition[];
  const catalogIds = new Set<string>(ACHIEVEMENT_CATALOG.map((a) => a.id));
  const achievements = (
    defRows.length > 0
      ? defRows
      : ACHIEVEMENT_CATALOG.map((a) => ({
          id: a.id,
          category: a.category,
          title: a.title,
          description: a.description,
          icon: a.icon,
          sort_order: 0,
          active: true,
          created_at: "",
        }))
  )
    .filter((d) => catalogIds.has(d.id) || defRows.length > 0)
    .map((d) => ({
      ...d,
      unlocked: unlockedMap.has(d.id),
      unlocked_at: unlockedMap.get(d.id)?.unlocked_at ?? null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const challengeIds = (memberships.data ?? []).map((m) => m.challenge_id);
  const challenges: typeof empty.challenges = [];
  if (challengeIds.length > 0) {
    const { data: challengeRows } = await supabase
      .from("study_challenges")
      .select("*")
      .in("id", challengeIds)
      .in("status", ["active", "completed"]);
    for (const challenge of challengeRows ?? []) {
      const { count } = await supabase
        .from("challenge_participants")
        .select("*", { count: "exact", head: true })
        .eq("challenge_id", challenge.id)
        .in("status", ["active", "completed"]);
      const progress = computeChallengeProgress({
        type: challenge.challenge_type as ChallengeType,
        target: Number(challenge.target_value),
        startsAt: challenge.starts_at,
        endsAt: challenge.ends_at,
        timeZone: prefs.timezone,
        sessions,
        minDailyFocusSeconds: prefs.min_daily_focus_minutes * 60,
      });
      challenges.push({
        challenge: challenge as StudyChallenge,
        progress,
        participantCount: count ?? 0,
      });
    }
  }

  const invitations: typeof empty.invitations = [];
  for (const inv of invites.data ?? []) {
    const { data: ch } = await supabase
      .from("study_challenges")
      .select("name")
      .eq("id", inv.challenge_id)
      .maybeSingle();
    invitations.push({
      ...(inv as ChallengeInvitation),
      challengeName: ch?.name ?? "Challenge",
    });
  }

  return {
    prefs,
    streak,
    weekly,
    achievements,
    recentUnlocks: (unlocks.data ?? []).slice(0, 5) as UserAchievement[],
    challenges,
    invitations,
    weeklyGoalHours,
  };
});

export type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  accent_color: AccentColor;
  avatar_preference: AvatarPreference;
  avatarSrc: string | null;
  focus_seconds: number;
  rank: number;
};

export const getFriendsLeaderboard = cache(async (): Promise<{
  rows: LeaderboardRow[];
  optedIn: boolean;
  weekStart: string;
  weekEnd: string;
}> => {
  const prefs = await getGamificationPreferences();
  const todayKey = defaultTodayKey(prefs.timezone);
  const weekStart = startOfLocalWeekKey(todayKey, prefs.timezone);
  const weekEnd = endOfLocalWeekKey(todayKey, prefs.timezone);

  if (!prefs.enabled || !prefs.leaderboard_opt_in) {
    return { rows: [], optedIn: false, weekStart, weekEnd };
  }

  const user = await getSessionUser();
  if (!user) return { rows: [], optedIn: true, weekStart, weekEnd };

  // Convert local week bounds to UTC instants roughly via Date parsing of noon then adjust
  // Better: use start of weekStart 00:00 local → ISO via iterative search
  const weekStartIso = localMidnightIso(weekStart, prefs.timezone);
  const weekEndExclusiveIso = localMidnightIso(
    addDaysKey(weekEnd, 1),
    prefs.timezone,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("friends_weekly_leaderboard", {
    p_week_start: weekStartIso,
    p_week_end: weekEndExclusiveIso,
  });

  if (error) {
    console.error("getFriendsLeaderboard:", error.message);
    return { rows: [], optedIn: true, weekStart, weekEnd };
  }

  const rows: LeaderboardRow[] = await Promise.all(
    (data ?? []).map(async (row) => {
      let avatarSrc: string | null = row.google_avatar_url;
      if (!avatarSrc && row.storage_path && row.can_view_avatar) {
        avatarSrc = await signAvatarPath(row.storage_path);
      }
      return {
        user_id: row.user_id,
        username: row.username,
        display_name: row.display_name,
        accent_color: row.accent_color,
        avatar_preference: row.avatar_preference,
        avatarSrc,
        focus_seconds: Number(row.focus_seconds),
        rank: Number(row.rank),
      };
    }),
  );

  return { rows, optedIn: true, weekStart, weekEnd };
});

function addDaysKey(dateKey: string, delta: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

