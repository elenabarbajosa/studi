"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  FOCUS_TIMER_MODES,
  SOUNDSCAPE_IDS,
} from "@/lib/calendar";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type FocusActionState = {
  error?: string;
  success?: string;
  id?: string;
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

function revalidateFocus() {
  revalidatePath("/focus");
  revalidatePath("/statistics");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

const optionalUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

const startSchema = z.object({
  client_session_id: z.string().uuid(),
  timer_mode: z.enum(FOCUS_TIMER_MODES),
  subject_id: optionalUuid,
  topic_id: optionalUuid,
  task_id: optionalUuid,
  goal: z.string().max(200).optional().or(z.literal("")),
  engine_state: z.record(z.string(), z.unknown()),
});

const heartbeatSchema = z.object({
  client_session_id: z.string().uuid(),
  engine_state: z.record(z.string(), z.unknown()),
  focus_seconds: z.number().int().min(0).max(86400),
  break_seconds: z.number().int().min(0).max(86400),
});

const finishSchema = z.object({
  client_session_id: z.string().uuid(),
  subject_id: optionalUuid,
  topic_id: optionalUuid,
  task_id: optionalUuid,
  goal: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  goal_completed: z.boolean().optional(),
  focus_seconds: z.number().int().min(0).max(86400),
  break_seconds: z.number().int().min(0).max(86400),
  timer_mode: z.enum(FOCUS_TIMER_MODES),
  pomodoro_cycles: z.number().int().min(0).max(48),
  started_at: z.string().datetime({ offset: true }),
  ended_at: z.string().datetime({ offset: true }),
});

export async function startFocusSession(
  payload: z.infer<typeof startSchema>,
): Promise<FocusActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = startSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid session" };
  }

  // Replace any existing active session for this user.
  await auth.supabase
    .from("focus_active_sessions")
    .delete()
    .eq("user_id", auth.user.id);

  const { data, error } = await auth.supabase
    .from("focus_active_sessions")
    .insert({
      user_id: auth.user.id,
      client_session_id: parsed.data.client_session_id,
      timer_mode: parsed.data.timer_mode,
      subject_id: parsed.data.subject_id || null,
      topic_id: parsed.data.topic_id || null,
      task_id: parsed.data.task_id || null,
      goal: parsed.data.goal?.trim() || null,
      engine_state: parsed.data.engine_state,
      focus_seconds: 0,
      break_seconds: 0,
      last_heartbeat_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/focus");
  return { success: "Session started", id: data.id };
}

export async function heartbeatFocusSession(
  payload: z.infer<typeof heartbeatSchema>,
): Promise<FocusActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = heartbeatSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid heartbeat" };
  }

  const { error } = await auth.supabase
    .from("focus_active_sessions")
    .update({
      engine_state: parsed.data.engine_state,
      focus_seconds: parsed.data.focus_seconds,
      break_seconds: parsed.data.break_seconds,
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("user_id", auth.user.id)
    .eq("client_session_id", parsed.data.client_session_id);

  if (error) return { error: error.message };
  return { success: "ok" };
}

export async function finishFocusSession(
  payload: z.infer<typeof finishSchema>,
): Promise<FocusActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = finishSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid finish data" };
  }

  // Idempotent: if already saved, treat as success.
  const { data: existing } = await auth.supabase
    .from("study_sessions")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("client_session_id", parsed.data.client_session_id)
    .maybeSingle();

  if (existing) {
    await auth.supabase
      .from("focus_active_sessions")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("client_session_id", parsed.data.client_session_id);
    revalidateFocus();
    return { success: "Session already saved", id: existing.id };
  }

  const focusSeconds = parsed.data.focus_seconds;
  if (focusSeconds < 30) {
    await auth.supabase
      .from("focus_active_sessions")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("client_session_id", parsed.data.client_session_id);
    revalidateFocus();
    return {
      error: "Sessions shorter than 30 seconds are not saved.",
    };
  }

  const planned = Math.max(5, Math.round(focusSeconds / 60));

  const { data, error } = await auth.supabase
    .from("study_sessions")
    .insert({
      user_id: auth.user.id,
      subject_id: parsed.data.subject_id || null,
      topic_id: parsed.data.topic_id || null,
      task_id: parsed.data.task_id || null,
      starts_at: parsed.data.started_at,
      ends_at: parsed.data.ended_at,
      planned_duration_minutes: planned,
      status: "completed",
      notes: parsed.data.notes?.trim() || null,
      source: "focus",
      timer_mode: parsed.data.timer_mode,
      focus_seconds: focusSeconds,
      break_seconds: parsed.data.break_seconds,
      goal: parsed.data.goal?.trim() || null,
      goal_completed: parsed.data.goal_completed ?? null,
      client_session_id: parsed.data.client_session_id,
      pomodoro_cycles: parsed.data.pomodoro_cycles,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      revalidateFocus();
      return { success: "Session already saved" };
    }
    return { error: error.message };
  }

  await auth.supabase
    .from("focus_active_sessions")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("client_session_id", parsed.data.client_session_id);

  // Gamification is best-effort — never block a successful save.
  let unlocked: string[] = [];
  try {
    const { evaluateAndAwardAchievements } = await import(
      "@/lib/progress/evaluate"
    );
    const { data: gprefs } = await auth.supabase
      .from("gamification_preferences")
      .select("*")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    unlocked = await evaluateAndAwardAchievements(auth.user.id, {
      enabled: gprefs?.enabled ?? true,
      timezone: gprefs?.timezone ?? "UTC",
      min_daily_focus_minutes: gprefs?.min_daily_focus_minutes ?? 15,
      rest_days: Array.isArray(gprefs?.rest_days)
        ? (gprefs.rest_days as never)
        : [],
    });
  } catch (err) {
    console.error("post-save achievement eval failed:", err);
  }

  revalidateFocus();
  revalidatePath("/progress");
  return {
    success:
      unlocked.length > 0
        ? `Session saved · ${unlocked.length} new achievement${unlocked.length === 1 ? "" : "s"}`
        : "Session saved",
    id: data.id,
  };
}

export async function discardFocusSession(
  clientSessionId?: string,
): Promise<FocusActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  let query = auth.supabase
    .from("focus_active_sessions")
    .delete()
    .eq("user_id", auth.user.id);

  if (clientSessionId) {
    query = query.eq("client_session_id", clientSessionId);
  }

  const { error } = await query;
  if (error) return { error: error.message };
  revalidatePath("/focus");
  return { success: "Session discarded" };
}

const focusPrefsSchema = z.object({
  pomodoro_focus_minutes: z.coerce.number().int().min(5).max(120),
  pomodoro_short_break_minutes: z.coerce.number().int().min(1).max(30),
  pomodoro_long_break_minutes: z.coerce.number().int().min(5).max(60),
  pomodoro_intervals_before_long: z.coerce.number().int().min(2).max(8),
  auto_start_breaks: z.boolean(),
  focus_sound_enabled: z.boolean(),
  soundscape_primary: z.enum(SOUNDSCAPE_IDS),
  soundscape_secondary: z.enum(SOUNDSCAPE_IDS),
  soundscape_volume: z.coerce.number().min(0).max(1),
  soundscape_secondary_volume: z.coerce.number().min(0).max(1),
});

export async function saveFocusPreferences(
  payload: z.infer<typeof focusPrefsSchema>,
): Promise<FocusActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = focusPrefsSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid preferences" };
  }

  const { data: existing } = await auth.supabase
    .from("study_preferences")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const error = existing
    ? (
        await auth.supabase
          .from("study_preferences")
          .update(parsed.data)
          .eq("user_id", auth.user.id)
      ).error
    : (
        await auth.supabase.from("study_preferences").insert({
          user_id: auth.user.id,
          ...parsed.data,
        })
      ).error;

  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/focus");
  return { success: "Focus preferences saved" };
}
