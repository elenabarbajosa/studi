"use server";

import { revalidatePath } from "next/cache";

import { buildEventRange } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { eventMoveSchema, personalEventSchema } from "@/lib/validations/phase3";

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
}

export async function createPersonalEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const allDay =
    formData.get("all_day") === "on" ||
    formData.get("all_day") === "true" ||
    !formData.get("start_time");

  const parsed = personalEventSchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    start_time: formData.get("start_time") || "",
    end_time: formData.get("end_time") || "",
    all_day: allDay,
    description: formData.get("description") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid event" };
  }

  const range = buildEventRange({
    date: parsed.data.date,
    startTime: allDay ? null : parsed.data.start_time || null,
    endTime: allDay ? null : parsed.data.end_time || null,
    allDay,
  });

  const { error } = await auth.supabase.from("calendar_events").insert({
    user_id: auth.user.id,
    title: parsed.data.title.trim(),
    description: parsed.data.description?.trim() || null,
    starts_at: range.starts_at,
    ends_at: range.ends_at,
    all_day: range.all_day,
  });

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Event created" };
}

export async function updatePersonalEvent(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const allDay =
    formData.get("all_day") === "on" ||
    formData.get("all_day") === "true" ||
    !formData.get("start_time");

  const parsed = personalEventSchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    start_time: formData.get("start_time") || "",
    end_time: formData.get("end_time") || "",
    all_day: allDay,
    description: formData.get("description") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid event" };
  }

  const range = buildEventRange({
    date: parsed.data.date,
    startTime: allDay ? null : parsed.data.start_time || null,
    endTime: allDay ? null : parsed.data.end_time || null,
    allDay,
  });

  const { error } = await auth.supabase
    .from("calendar_events")
    .update({
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      starts_at: range.starts_at,
      ends_at: range.ends_at,
      all_day: range.all_day,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Event updated" };
}

export async function deletePersonalEvent(id: string): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Event deleted" };
}

export async function movePersonalEvent(
  id: string,
  payload: { starts_at: string; ends_at?: string | null; all_day?: boolean },
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = eventMoveSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid move" };
  }

  const { error } = await auth.supabase
    .from("calendar_events")
    .update({
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at ?? null,
      ...(parsed.data.all_day !== undefined
        ? { all_day: parsed.data.all_day }
        : {}),
    })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateCalendar();
  return { success: "Moved" };
}
