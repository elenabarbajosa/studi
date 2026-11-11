"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  ACCENT_COLORS,
  APPEARANCE_MODES,
  isAccentColor,
  isAppearanceMode,
  type AccentColor,
  type AppearanceMode,
} from "@/lib/theme";
import { profileSchema } from "@/lib/validations/auth";

export type ProfileActionState = {
  error?: string;
  success?: string;
};

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const parsed = profileSchema.safeParse({
    username: formData.get("username"),
    display_name: formData.get("display_name"),
    bio: formData.get("bio") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile data" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username,
      display_name: parsed.data.display_name,
      bio: parsed.data.bio || null,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "That username is already taken." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "Profile updated." };
}

export async function updateAppearance(
  appearance: AppearanceMode,
): Promise<ProfileActionState> {
  if (!isAppearanceMode(appearance)) {
    return { error: "Invalid appearance mode." };
  }

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

  const { error } = await supabase
    .from("profiles")
    .update({ appearance })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "Appearance updated." };
}

export async function updateAccentColor(
  accent: AccentColor,
): Promise<ProfileActionState> {
  if (!isAccentColor(accent)) {
    return { error: "Invalid accent color." };
  }

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

  const { error } = await supabase
    .from("profiles")
    .update({ accent_color: accent })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "Accent color updated." };
}

export { APPEARANCE_MODES, ACCENT_COLORS };
