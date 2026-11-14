"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  ROOM_TIMER_ACTIONS,
  STUDY_ROOM_VISIBILITIES,
  type RoomTimerAction,
  type StudyRoomTimerState,
} from "@/lib/study-together/types";

export type StudyTogetherActionState = {
  error?: string;
  success?: string;
  roomId?: string;
  inviteId?: string;
  token?: string;
  inviteUrl?: string;
  timer?: StudyRoomTimerState;
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

function revalidateRooms(roomId?: string) {
  revalidatePath("/study-together");
  revalidatePath("/dashboard");
  if (roomId) revalidatePath(`/study-together/${roomId}`);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional().or(z.literal("")),
  visibility: z.enum(STUDY_ROOM_VISIBILITIES),
  max_participants: z.coerce.number().int().min(2).max(16),
  focus_minutes: z.coerce.number().int().min(5).max(120),
  short_break_minutes: z.coerce.number().int().min(1).max(30),
  long_break_minutes: z.coerce.number().int().min(5).max(60),
  intervals_before_long: z.coerce.number().int().min(2).max(8),
  chat_enabled: z.boolean(),
  members_can_invite: z.boolean(),
});

export async function createStudyRoom(
  input: z.infer<typeof createSchema>,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid room" };
  }

  const { data, error } = await auth.supabase.rpc("create_study_room", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
    p_visibility: parsed.data.visibility,
    p_max_participants: parsed.data.max_participants,
    p_focus_minutes: parsed.data.focus_minutes,
    p_short_break_minutes: parsed.data.short_break_minutes,
    p_long_break_minutes: parsed.data.long_break_minutes,
    p_intervals_before_long: parsed.data.intervals_before_long,
    p_chat_enabled: parsed.data.chat_enabled,
    p_members_can_invite: parsed.data.members_can_invite,
  });

  if (error) return { error: error.message };
  const roomId = data as string;
  revalidateRooms(roomId);
  return { success: "Room created", roomId };
}

export async function inviteFriendToRoom(
  roomId: string,
  friendUserId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await auth.supabase.rpc("create_study_room_invite", {
    p_room_id: roomId,
    p_invitee_id: friendUserId,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });

  if (error) return { error: error.message };

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const inviteUrl = `${site}/study-together/join?token=${token}`;

  revalidateRooms(roomId);
  return {
    success: "Invitation created",
    inviteId: data as string,
    token,
    inviteUrl,
  };
}

export async function acceptInviteByToken(
  token: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  if (!token.trim()) return { error: "Missing invite token" };

  const { data, error } = await auth.supabase.rpc("accept_study_room_invite", {
    p_token_hash: hashToken(token.trim()),
  });
  if (error) return { error: error.message };
  const roomId = data as string;
  revalidateRooms(roomId);
  return { success: "Joined room", roomId };
}

export async function respondToInvite(
  inviteId: string,
  accept: boolean,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.rpc("respond_study_room_invite", {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  if (error) return { error: error.message };
  revalidateRooms();
  return {
    success: accept ? "Invitation accepted" : "Invitation declined",
  };
}

export async function cancelInvite(
  inviteId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("cancel_study_room_invite", {
    p_invite_id: inviteId,
  });
  if (error) return { error: error.message };
  revalidateRooms();
  return { success: "Invitation cancelled" };
}

export async function joinFriendsRoom(
  roomId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("join_friends_study_room", {
    p_room_id: roomId,
  });
  if (error) return { error: error.message };
  revalidateRooms(roomId);
  return { success: "Joined room", roomId };
}

export async function leaveRoom(
  roomId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("leave_study_room", {
    p_room_id: roomId,
  });
  if (error) return { error: error.message };
  revalidateRooms(roomId);
  return { success: "Left room" };
}

export async function kickMember(
  roomId: string,
  userId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("kick_study_room_member", {
    p_room_id: roomId,
    p_user_id: userId,
  });
  if (error) return { error: error.message };
  revalidateRooms(roomId);
  return { success: "Participant removed" };
}

export async function endRoom(
  roomId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("end_study_room", {
    p_room_id: roomId,
  });
  if (error) return { error: error.message };
  revalidateRooms(roomId);
  return { success: "Room ended" };
}

export async function transferHost(
  roomId: string,
  newHostId?: string | null,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase.rpc("transfer_study_room_host", {
    p_room_id: roomId,
    p_new_host_id: newHostId ?? null,
  });
  if (error) return { error: error.message };
  revalidateRooms(roomId);
  return { success: "Host transferred" };
}

export async function roomTimerCommand(
  roomId: string,
  action: RoomTimerAction,
  expectedRevision: number,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  if (!(ROOM_TIMER_ACTIONS as readonly string[]).includes(action)) {
    return { error: "Invalid timer action" };
  }

  const { data, error } = await auth.supabase.rpc("room_timer_command", {
    p_room_id: roomId,
    p_action: action,
    p_expected_revision: expectedRevision,
  });

  if (error) {
    if (error.message.includes("STALE_REVISION")) {
      return { error: "Timer state changed — refresh and try again." };
    }
    return { error: error.message };
  }

  revalidateRooms(roomId);
  return {
    success: "Timer updated",
    timer: data as StudyRoomTimerState,
  };
}

export async function reconcileRoomTimer(
  roomId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { data, error } = await auth.supabase.rpc("reconcile_room_timer", {
    p_room_id: roomId,
  });
  if (error) return { error: error.message };
  return { timer: data as StudyRoomTimerState };
}

export async function sendRoomMessage(
  roomId: string,
  body: string,
  clientMessageId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 500) {
    return { error: "Message must be 1–500 characters" };
  }
  const { error } = await auth.supabase.rpc("send_study_room_message", {
    p_room_id: roomId,
    p_body: trimmed,
    p_client_message_id: clientMessageId,
  });
  if (error) return { error: error.message };
  return { success: "Sent" };
}

export async function deleteOwnRoomMessage(
  messageId: string,
  roomId: string,
): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };
  const { error } = await auth.supabase
    .from("study_room_messages")
    .update({ deleted_at: new Date().toISOString(), body: "[deleted]" })
    .eq("id", messageId)
    .eq("sender_id", auth.user.id)
    .eq("room_id", roomId);
  if (error) return { error: error.message };
  return { success: "Message deleted" };
}

export async function saveStudyTogetherSession(input: {
  client_session_id: string;
  room_id: string;
  subject_id?: string | null;
  topic_id?: string | null;
  task_id?: string | null;
  goal?: string;
  notes?: string;
  goal_completed?: boolean;
  focus_seconds: number;
  break_seconds: number;
  pomodoro_cycles: number;
  started_at: string;
  ended_at: string;
}): Promise<StudyTogetherActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { data: existing } = await auth.supabase
    .from("study_sessions")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("client_session_id", input.client_session_id)
    .maybeSingle();

  if (existing) {
    revalidatePath("/statistics");
    return { success: "Session already saved", roomId: existing.id };
  }

  if (input.focus_seconds < 30) {
    return { error: "Sessions shorter than 30 seconds are not saved." };
  }

  const planned = Math.max(5, Math.round(input.focus_seconds / 60));
  const { error } = await auth.supabase.from("study_sessions").insert({
    user_id: auth.user.id,
    subject_id: input.subject_id || null,
    topic_id: input.topic_id || null,
    task_id: input.task_id || null,
    starts_at: input.started_at,
    ends_at: input.ended_at,
    planned_duration_minutes: planned,
    status: "completed",
    notes: input.notes?.trim() || null,
    source: "study_together",
    timer_mode: "pomodoro",
    focus_seconds: input.focus_seconds,
    break_seconds: input.break_seconds,
    goal: input.goal?.trim() || null,
    goal_completed: input.goal_completed ?? null,
    client_session_id: input.client_session_id,
    pomodoro_cycles: input.pomodoro_cycles,
    room_id: input.room_id,
  });

  if (error) {
    if (error.code === "23505") {
      revalidatePath("/statistics");
      return { success: "Session already saved" };
    }
    return { error: error.message };
  }

  try {
    const { evaluateAndAwardAchievements } = await import(
      "@/lib/progress/evaluate"
    );
    const { data: gprefs } = await auth.supabase
      .from("gamification_preferences")
      .select("*")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    await evaluateAndAwardAchievements(auth.user.id, {
      enabled: gprefs?.enabled ?? true,
      timezone: gprefs?.timezone ?? "UTC",
      min_daily_focus_minutes: gprefs?.min_daily_focus_minutes ?? 15,
      rest_days: Array.isArray(gprefs?.rest_days)
        ? (gprefs.rest_days as never)
        : [],
    });
  } catch (err) {
    console.error("study-together achievement eval failed:", err);
  }

  revalidatePath("/statistics");
  revalidatePath("/dashboard");
  revalidatePath("/progress");
  revalidateRooms(input.room_id);
  return { success: "Focus time saved" };
}
