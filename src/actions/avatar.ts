"use server";

import { revalidatePath } from "next/cache";

import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_SIGNED_URL_TTL_SECONDS,
  buildAvatarObjectPath,
  detectImageMime,
  isAvatarPreference,
} from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AvatarPreference } from "@/types/database";

export type AvatarActionState = {
  error?: string;
  success?: string;
  signedUrl?: string;
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

function revalidateAvatarPaths() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

async function deleteOwnedObject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  path: string | null | undefined,
) {
  if (!path) return;
  if (!path.startsWith(`${userId}/`)) return;
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

export async function uploadAvatar(
  formData: FormData,
): Promise<AvatarActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return { error: "Choose an image to upload." };
  }

  if (file.size <= 0) {
    return { error: "The selected file is empty." };
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return { error: "Images must be 5 MB or smaller." };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageMime(buffer);
  if (!mime) {
    return {
      error: "Only JPEG, PNG, or WebP images are supported.",
    };
  }

  // Prefer declared type only when it matches magic bytes.
  if (file.type && file.type !== mime && !file.type.startsWith("image/")) {
    return { error: "Only JPEG, PNG, or WebP images are supported." };
  }

  const { data: existing } = await auth.supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", auth.user.id)
    .maybeSingle();

  const objectPath = buildAvatarObjectPath(auth.user.id, mime);

  const { error: uploadError } = await auth.supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, buffer, {
      contentType: mime,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    return {
      error:
        uploadError.message.includes("Bucket not found") ||
        uploadError.message.includes("not found")
          ? "Avatar storage is not configured. Apply migration 005 and create the avatars bucket."
          : uploadError.message,
    };
  }

  const { error: updateError } = await auth.supabase
    .from("profiles")
    .update({
      avatar_path: objectPath,
      avatar_preference: "custom" satisfies AvatarPreference,
      avatar_url: null,
    })
    .eq("id", auth.user.id);

  if (updateError) {
    await deleteOwnedObject(auth.supabase, auth.user.id, objectPath);
    return { error: updateError.message };
  }

  if (existing?.avatar_path && existing.avatar_path !== objectPath) {
    await deleteOwnedObject(auth.supabase, auth.user.id, existing.avatar_path);
  }

  const { data: signed } = await auth.supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(objectPath, AVATAR_SIGNED_URL_TTL_SECONDS);

  revalidateAvatarPaths();
  return {
    success: "Profile picture saved.",
    signedUrl: signed?.signedUrl,
  };
}

export async function setAvatarPreference(
  preference: AvatarPreference,
): Promise<AvatarActionState> {
  if (!isAvatarPreference(preference) || preference === "custom") {
    return { error: "Choose Google or initials as the avatar style." };
  }

  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { data: profile, error: loadError } = await auth.supabase
    .from("profiles")
    .select("avatar_path, google_avatar_url")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!profile) return { error: "Profile not found." };

  if (preference === "google" && !profile.google_avatar_url) {
    return {
      error: "No Google profile picture is available for this account.",
    };
  }

  const previousPath = profile.avatar_path;

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      avatar_preference: preference,
      // Leaving custom storage when switching away — remove file to avoid orphans.
      avatar_path: preference === "initials" || preference === "google" ? null : profile.avatar_path,
      avatar_url: null,
    })
    .eq("id", auth.user.id);

  if (error) return { error: error.message };

  if (previousPath) {
    await deleteOwnedObject(auth.supabase, auth.user.id, previousPath);
  }

  revalidateAvatarPaths();
  return {
    success:
      preference === "google"
        ? "Using your Google profile picture."
        : "Using your initials avatar.",
  };
}

export async function removeCustomAvatar(): Promise<AvatarActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { data: profile, error: loadError } = await auth.supabase
    .from("profiles")
    .select("avatar_path, google_avatar_url, avatar_preference")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!profile) return { error: "Profile not found." };

  const nextPreference: AvatarPreference = profile.google_avatar_url
    ? "google"
    : "initials";

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      avatar_path: null,
      avatar_preference: nextPreference,
      avatar_url: null,
    })
    .eq("id", auth.user.id);

  if (error) return { error: error.message };

  await deleteOwnedObject(auth.supabase, auth.user.id, profile.avatar_path);

  revalidateAvatarPaths();
  return {
    success:
      nextPreference === "google"
        ? "Custom picture removed. Showing your Google photo."
        : "Custom picture removed. Showing initials.",
  };
}

/**
 * Refresh Google avatar URL from auth metadata without overwriting a custom preference.
 */
export async function syncGoogleAvatarFromUser(user: {
  id: string;
  user_metadata?: Record<string, unknown> | null;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const googleUrl =
    (typeof user.user_metadata?.avatar_url === "string" &&
      user.user_metadata.avatar_url) ||
    (typeof user.user_metadata?.picture === "string" &&
      user.user_metadata.picture) ||
    null;

  if (!googleUrl) return;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, google_avatar_url, avatar_preference")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return;

  const updates: {
    google_avatar_url: string;
    avatar_preference?: AvatarPreference;
  } = {
    google_avatar_url: googleUrl,
  };

  // Only adopt Google as the active preference when the user has never chosen
  // custom/initials deliberately and currently has no preference source.
  // Never overwrite custom. If preference is google, keep syncing the URL.
  if (
    profile.avatar_preference === "initials" &&
    !profile.google_avatar_url
  ) {
    updates.avatar_preference = "google";
  }

  if (profile.google_avatar_url === googleUrl && !updates.avatar_preference) {
    return;
  }

  await supabase.from("profiles").update(updates).eq("id", user.id);
}
