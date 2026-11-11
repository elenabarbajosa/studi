import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types/database";

export async function getSessionUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }

  return data;
}

export async function requireProfile() {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return { user, profile };
}
