"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { evaluateAndAwardAchievements } from "@/lib/progress/evaluate";
import { CHALLENGE_TYPES } from "@/lib/progress/challenges";
import { WEEKDAYS } from "@/lib/subjects";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ProgressActionState = {
  error?: string;
  success?: string;
  unlocked?: string[];
  challengeId?: string;
};

async function authClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." } as const;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." } as const;
  return { supabase, user } as const;
}

function revalidateProgress() {
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  revalidatePath("/statistics");
  revalidatePath("/settings");
  revalidatePath("/friends");
}

const prefsSchema = z.object({
  enabled: z.boolean(),
  leaderboard_opt_in: z.boolean(),
  achievement_notifications: z.boolean(),
  accept_challenge_invites: z.boolean(),
  timezone: z.string().min(1).max(64),
  min_daily_focus_minutes: z.coerce.number().int().min(1).max(180),
  rest_days: z.array(z.enum(WEEKDAYS)),
  consistency_days_per_week: z
    .number()
    .int()
    .min(1)
    .max(7)
    .nullable()
    .optional(),
  weekly_goal_hours: z.coerce.number().min(0).max(80).nullable().optional(),
});

export async function updateGamificationPreferences(
  input: z.infer<typeof prefsSchema>,
): Promise<ProgressActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const { error } = await auth.supabase.from("gamification_preferences").upsert({
    user_id: auth.user.id,
    enabled: parsed.data.enabled,
    leaderboard_opt_in: parsed.data.leaderboard_opt_in,
    achievement_notifications: parsed.data.achievement_notifications,
    accept_challenge_invites: parsed.data.accept_challenge_invites,
    timezone: parsed.data.timezone,
    min_daily_focus_minutes: parsed.data.min_daily_focus_minutes,
    rest_days: parsed.data.rest_days,
    consistency_days_per_week: parsed.data.consistency_days_per_week ?? null,
  });

  if (error) return { error: error.message };

  if (parsed.data.weekly_goal_hours !== undefined) {
    const { error: goalError } = await auth.supabase
      .from("study_preferences")
      .update({ weekly_goal_hours: parsed.data.weekly_goal_hours })
      .eq("user_id", auth.user.id);
    if (goalError) {
      // Row may not exist yet for edge accounts — ignore; study prefs form owns creation.
      console.error("weekly_goal_hours update:", goalError.message);
    }
  }

  revalidateProgress();
  return { success: "Gamification settings saved" };
}

export async function refreshAchievements(): Promise<ProgressActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { data: prefs } = await auth.supabase
    .from("gamification_preferences")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const unlocked = await evaluateAndAwardAchievements(auth.user.id, {
    enabled: prefs?.enabled ?? true,
    timezone: prefs?.timezone ?? "UTC",
    min_daily_focus_minutes: prefs?.min_daily_focus_minutes ?? 15,
    rest_days: Array.isArray(prefs?.rest_days)
      ? (prefs.rest_days as never)
      : [],
  });

  revalidateProgress();
  return {
    success:
      unlocked.length > 0
        ? `Unlocked ${unlocked.length} achievement${unlocked.length === 1 ? "" : "s"}`
        : "Achievements up to date",
    unlocked,
  };
}

const challengeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  challenge_type: z.enum(CHALLENGE_TYPES),
  target_value: z.coerce.number().positive().max(100000),
  visibility: z.enum(["individual", "collaborative"]),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  show_individual_contributions: z.boolean().optional(),
  invitee_ids: z.array(z.string().uuid()).optional(),
});

export async function createChallenge(
  input: z.infer<typeof challengeSchema>,
): Promise<ProgressActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = challengeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid challenge" };
  }
  if (new Date(parsed.data.ends_at) <= new Date(parsed.data.starts_at)) {
    return { error: "End date must be after start date" };
  }

  const { data, error } = await auth.supabase.rpc("create_study_challenge", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
    p_challenge_type: parsed.data.challenge_type,
    p_target_value: parsed.data.target_value,
    p_visibility: parsed.data.visibility,
    p_starts_at: parsed.data.starts_at,
    p_ends_at: parsed.data.ends_at,
    p_show_individual_contributions:
      parsed.data.show_individual_contributions ?? false,
  });

  if (error) return { error: error.message };
  const challengeId = data as string;

  if (
    parsed.data.visibility === "collaborative" &&
    parsed.data.invitee_ids?.length
  ) {
    const expires = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    for (const invitee of parsed.data.invitee_ids) {
      await auth.supabase.rpc("invite_to_challenge", {
        p_challenge_id: challengeId,
        p_invitee_id: invitee,
        p_expires_at: expires,
      });
    }
  }

  revalidateProgress();
  return { success: "Challenge created", challengeId };
}

export async function inviteToChallenge(
  challengeId: string,
  inviteeId: string,
): Promise<ProgressActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const expires = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
  const { error } = await auth.supabase.rpc("invite_to_challenge", {
    p_challenge_id: challengeId,
    p_invitee_id: inviteeId,
    p_expires_at: expires,
  });
  if (error) return { error: error.message };
  revalidateProgress();
  return { success: "Invitation sent" };
}

export async function respondChallengeInvite(
  inviteId: string,
  accept: boolean,
): Promise<ProgressActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("respond_challenge_invite", {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  if (error) return { error: error.message };
  revalidateProgress();
  return {
    success: accept ? "Joined challenge" : "Invitation declined",
  };
}

export async function cancelChallenge(
  challengeId: string,
): Promise<ProgressActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("cancel_challenge", {
    p_challenge_id: challengeId,
  });
  if (error) return { error: error.message };
  revalidateProgress();
  return { success: "Challenge cancelled" };
}

export async function completeChallengeForSelf(
  challengeId: string,
): Promise<ProgressActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc(
    "mark_challenge_participant_completed",
    { p_challenge_id: challengeId },
  );
  if (error) return { error: error.message };

  const { data: prefs } = await auth.supabase
    .from("gamification_preferences")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const unlocked = await evaluateAndAwardAchievements(auth.user.id, {
    enabled: prefs?.enabled ?? true,
    timezone: prefs?.timezone ?? "UTC",
    min_daily_focus_minutes: prefs?.min_daily_focus_minutes ?? 15,
    rest_days: Array.isArray(prefs?.rest_days) ? (prefs.rest_days as never) : [],
  });

  revalidateProgress();
  return { success: "Challenge marked complete", unlocked };
}
