import "server-only";

import {
  AVATAR_BUCKET,
  AVATAR_SIGNED_URL_TTL_SECONDS,
  type ProfileAvatarFields,
} from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve a displayable image URL for the current viewer.
 * Custom avatars use short-lived signed URLs (never stored on the profile).
 */
export async function resolveAvatarSrc(
  profile: ProfileAvatarFields,
): Promise<string | null> {
  if (profile.avatar_preference === "initials") {
    return null;
  }

  if (
    profile.avatar_preference === "google" &&
    profile.google_avatar_url
  ) {
    return profile.google_avatar_url;
  }

  if (
    profile.avatar_preference === "custom" &&
    profile.avatar_path
  ) {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(profile.avatar_path, AVATAR_SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.error("resolveAvatarSrc:", error?.message);
      return null;
    }
    return data.signedUrl;
  }

  // Preference google/custom but source missing → initials fallback
  return null;
}
