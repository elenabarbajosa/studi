import "server-only";

import { cache } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { needsOnboarding } from "@/lib/onboarding";
import type { Profile } from "@/types/database";

/**
 * Request-deduped session read. Call only from components that sit behind a
 * `<Suspense>` boundary (Cache Components + Supabase JWT uses Date.now()).
 */
export const getSessionUser = cache(async () => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  await io();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

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

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
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
});

export async function requireProfile(options?: {
  allowIncompleteOnboarding?: boolean;
}) {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  if (
    !options?.allowIncompleteOnboarding &&
    needsOnboarding(profile)
  ) {
    redirect("/onboarding");
  }

  return { user, profile };
}
