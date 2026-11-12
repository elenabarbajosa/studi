"use server";

import { revalidatePath } from "next/cache";

import { buildEventRange, isStudySessionStatus } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { eventMoveSchema, studySessionSchema } from "@/lib/validations/phase3";

export type ActionState = { error?: string; success?: string };

async function authClient() {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." } as const;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." } as const;
  return { supabase, user } as const;
}

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

export async function createStudySession(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = studySessionSchema.safeParse({
    subject_id: formData.get("subject_id") || null,
    topic_id: formData.get("topic_id") || null,
    task_id: formData.get("task_id") || null,
    date: formData.get("date"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    status: formData.get("status") || "planned",
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid session" };
  }

  const range = buildEventRange({
    date: parsed.data.date,
    startTime: parsed.data.start_time,
    endTime: parsed.data.end_time,
    allDay: false,
  });

  const durationMinutes = Math.max(
    5,
    Math.round(
      (new Date(range.ends_at!).getTime() -
        new Date(range.starts_at).getTime()) /
        60000,
    ),
  );

  const { error } = await auth.supabase.from("study_sessions").insert({
    user_id: auth.user.id,
    subject_id: parsed.data.subject_id || null,
    topic_id: parsed.data.topic_id || null,
    task_id: parsed.data.task_id || null,
    starts_at: range.starts_at,
    ends_at: range.ends_at!,
    planned_duration_minutes: durationMinutes,
    status: parsed.data.status ?? "planned",
    notes: parsed.data.notes?.trim() || null,
  });

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Study session created" };
}

export async function updateStudySession(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = studySessionSchema.safeParse({
    subject_id: formData.get("subject_id") || null,
    topic_id: formData.get("topic_id") || null,
    task_id: formData.get("task_id") || null,
    date: formData.get("date"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    status: formData.get("status") || "planned",
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid session" };
  }

  const range = buildEventRange({
    date: parsed.data.date,
    startTime: parsed.data.start_time,
    endTime: parsed.data.end_time,
    allDay: false,
  });

  const durationMinutes = Math.max(
    5,
    Math.round(
      (new Date(range.ends_at!).getTime() -
        new Date(range.starts_at).getTime()) /
        60000,
    ),
  );

  const { error } = await auth.supabase
    .from("study_sessions")
    .update({
      subject_id: parsed.data.subject_id || null,
      topic_id: parsed.data.topic_id || null,
      task_id: parsed.data.task_id || null,
      starts_at: range.starts_at,
      ends_at: range.ends_at!,
      planned_duration_minutes: durationMinutes,
      status: parsed.data.status ?? "planned",
      notes: parsed.data.notes?.trim() || null,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Session updated" };
}

export async function setStudySessionStatus(
  id: string,
  status: string,
): Promise<ActionState> {
  if (!isStudySessionStatus(status)) return { error: "Invalid status" };
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("study_sessions")
    .update({ status })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Status updated" };
}

export async function deleteStudySession(id: string): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("study_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Session deleted" };
}

export async function moveStudySession(
  id: string,
  payload: { starts_at: string; ends_at?: string | null },
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = eventMoveSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.ends_at) {
    return { error: "Study sessions need a start and end time" };
  }

  const { error } = await auth.supabase
    .from("study_sessions")
    .update({
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Moved" };
}
