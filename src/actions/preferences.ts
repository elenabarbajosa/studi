"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DEFAULT_WEEKDAY_AVAILABILITY, WEEKDAYS } from "@/lib/subjects";
import { studyPreferencesSchema } from "@/lib/validations/phase2";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function saveStudyPreferences(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const availability = { ...DEFAULT_WEEKDAY_AVAILABILITY };
  for (const day of WEEKDAYS) {
    availability[day] = formData.get(`day_${day}`) === "on";
  }

  const parsed = studyPreferencesSchema.safeParse({
    weekday_availability: availability,
    session_duration_minutes: formData.get("session_duration_minutes"),
    break_duration_minutes: formData.get("break_duration_minutes"),
    weekly_goal_hours: formData.get("weekly_goal_hours"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid preferences" };
  }

  const { error } = await supabase.from("study_preferences").upsert({
    user_id: user.id,
    weekday_availability: parsed.data.weekday_availability,
    session_duration_minutes: parsed.data.session_duration_minutes,
    break_duration_minutes: parsed.data.break_duration_minutes,
    weekly_goal_hours: parsed.data.weekly_goal_hours,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/onboarding");
  return { success: "Study preferences saved." };
}
