"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isPresenceStatus, type PresenceStatus } from "@/lib/social";

export type PresenceActionState = {
  error?: string;
  success?: string;
};

/**
 * Low-frequency presence upsert. Call on focus start/pause/finish and ~60s
 * heartbeats — never every second.
 */
export async function upsertPresence(input: {
  status: PresenceStatus;
  activity_label?: string | null;
}): Promise<PresenceActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  if (!isPresenceStatus(input.status)) {
    return { error: "Invalid presence status" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const label =
    input.activity_label?.trim().slice(0, 40) ||
    (input.status === "focusing"
      ? "Focusing"
      : input.status === "on_break"
        ? "On break"
        : null);

  const { error } = await supabase.from("user_presence").upsert(
    {
      user_id: user.id,
      status: input.status,
      activity_label: label,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { error: error.message };
  return { success: "ok" };
}

export async function clearPresence(): Promise<PresenceActionState> {
  return upsertPresence({ status: "offline", activity_label: null });
}
