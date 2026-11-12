"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ACCENT_COOKIE } from "@/lib/accent-cookie";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DEFAULT_WEEKDAY_AVAILABILITY } from "@/lib/subjects";
import {
  onboardingPersonalizeSchema,
  studyPreferencesSchema,
  subjectInputSchema,
} from "@/lib/validations/phase2";
import { cookies } from "next/headers";

export type ActionState = {
  error?: string;
  success?: string;
};

async function requireAuthedClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." } as const;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." } as const;
  }
  return { supabase, user } as const;
}

export async function saveOnboardingPersonalize(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = onboardingPersonalizeSchema.safeParse({
    display_name: formData.get("display_name"),
    appearance: formData.get("appearance"),
    accent_color: formData.get("accent_color"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name.trim(),
      appearance: parsed.data.appearance,
      accent_color: parsed.data.accent_color,
      onboarding_status: "in_progress",
      onboarding_step: 2,
    })
    .eq("id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCENT_COOKIE, parsed.data.accent_color, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/onboarding");
  revalidatePath("/settings");
  return { success: "Preferences saved" };
}

export async function addOnboardingSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const difficultyRaw = formData.get("difficulty");
  const parsed = subjectInputSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
    difficulty:
      difficultyRaw === "" || difficultyRaw === null
        ? null
        : Number(difficultyRaw),
    description: "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subject" };
  }

  const { count } = await auth.supabase
    .from("subjects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", auth.user.id);

  const { error } = await auth.supabase.from("subjects").insert({
    user_id: auth.user.id,
    name: parsed.data.name.trim(),
    color: parsed.data.color,
    difficulty: parsed.data.difficulty ?? null,
    sort_order: count ?? 0,
  });

  if (error) {
    return { error: error.message };
  }

  await auth.supabase
    .from("profiles")
    .update({ onboarding_status: "in_progress", onboarding_step: 2 })
    .eq("id", auth.user.id);

  revalidatePath("/onboarding");
  revalidatePath("/subjects");
  return { success: "Subject added" };
}

export async function removeOnboardingSubject(subjectId: string) {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("user_id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/subjects");
  return { success: "Subject removed" };
}

export async function advanceOnboardingToPreferences(): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("profiles")
    .update({ onboarding_status: "in_progress", onboarding_step: 3 })
    .eq("id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/onboarding");
  return { success: "Continue" };
}

export async function setOnboardingStep(step: 1 | 2 | 3): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      onboarding_status: "in_progress",
      onboarding_step: step,
    })
    .eq("id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/onboarding");
  return { success: "Step updated" };
}

export async function finishOnboarding(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const availability: Record<string, boolean> = {};
  for (const day of [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
  ] as const) {
    availability[day] = formData.get(`day_${day}`) === "on";
  }

  const parsed = studyPreferencesSchema.safeParse({
    weekday_availability: {
      ...DEFAULT_WEEKDAY_AVAILABILITY,
      ...availability,
    },
    session_duration_minutes: formData.get("session_duration_minutes"),
    break_duration_minutes: formData.get("break_duration_minutes"),
    weekly_goal_hours: formData.get("weekly_goal_hours"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid preferences" };
  }

  const { error: prefError } = await auth.supabase
    .from("study_preferences")
    .upsert({
      user_id: auth.user.id,
      weekday_availability: parsed.data.weekday_availability,
      session_duration_minutes: parsed.data.session_duration_minutes,
      break_duration_minutes: parsed.data.break_duration_minutes,
      weekly_goal_hours: parsed.data.weekly_goal_hours,
    });

  if (prefError) {
    return { error: prefError.message };
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      onboarding_status: "completed",
      onboarding_step: 3,
    })
    .eq("id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/subjects");
  redirect("/dashboard");
}

export async function skipOnboarding(): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  // Ensure prefs row exists with defaults so Settings has something to edit.
  await auth.supabase.from("study_preferences").upsert({
    user_id: auth.user.id,
    weekday_availability: DEFAULT_WEEKDAY_AVAILABILITY,
  });

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      onboarding_status: "skipped",
      onboarding_step: 1,
    })
    .eq("id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/dashboard");
}
