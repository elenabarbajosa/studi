"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ACCENT_COOKIE } from "@/lib/accent-cookie";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
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
      username: parsed.data.username.toLowerCase(),
      display_name: parsed.data.display_name.trim(),
      bio: parsed.data.bio?.trim() || null,
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

  // Do not revalidatePath here: client theme state is already applied and a
  // full RSC refresh feels like an unexpected reload. Persistence is verified
  // on the next navigation/refresh via ThemeSync + profiles.appearance.
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

  const cookieStore = await cookies();
  cookieStore.set(ACCENT_COOKIE, accent, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return { success: "Accent color updated." };
}
