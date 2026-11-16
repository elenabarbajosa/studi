import "server-only";

import {
  AVATAR_BUCKET,
  AVATAR_SIGNED_URL_TTL_SECONDS,
  type ProfileAvatarFields,
} from "@/lib/avatar";
import {
  isAvatarStoragePath,
  ownerIdFromAvatarPath,
  resolveVisibleAvatarSrc,
} from "@/lib/avatar-access";
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AvatarPreference } from "@/types/database";

type StorageClient = Awaited<ReturnType<typeof createClient>>;

async function mintSignedUrl(
  client: StorageClient | ReturnType<typeof createServiceRoleClient>,
  path: string,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Confirm the current viewer may read this private avatar object.
 * Prefers can_read_avatar_object (021); falls back to get_social_profile_by_id.
 */
async function viewerMayReadAvatarObject(
  supabase: StorageClient,
  path: string,
  ownerId: string,
  viewerId: string,
): Promise<boolean> {
  if (viewerId === ownerId) return true;

  const { data: allowed, error } = await supabase.rpc(
    "can_read_avatar_object",
    { object_name: path },
  );

  if (!error && typeof allowed === "boolean") {
    return allowed;
  }

  // Pre-migration fallback: social RPC already gates storage_path.
  const { data: profile } = await supabase.rpc("get_social_profile_by_id", {
    target_id: ownerId,
  });
  if (!profile || typeof profile !== "object") return false;
  const storagePath =
    (profile as { avatar?: { storage_path?: string | null; can_view?: boolean } })
      .avatar?.storage_path ?? null;
  return storagePath === path;
}

/**
 * Mint a short-lived signed URL for a private avatar object after authz.
 * Does not make the bucket public. Rejects malformed / unauthorized paths.
 */
export async function signAuthorizedAvatarPath(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path || !isAvatarStoragePath(path)) return null;
  const ownerId = ownerIdFromAvatarPath(path);
  if (!ownerId) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const authorized = await viewerMayReadAvatarObject(
    supabase,
    path,
    ownerId,
    user.id,
  );
  if (!authorized) return null;

  // Prefer the viewer's JWT (works for owners always; for others after 021).
  const withUserJwt = await mintSignedUrl(supabase, path);
  if (withUserJwt) return withUserJwt;

  // Before migration 021, Storage SELECT for other users fails. After the
  // authz check above, mint with the service role so Public/Friends photos
  // still resolve without exposing private objects.
  if (!isServiceRoleConfigured()) {
    console.error(
      "signAuthorizedAvatarPath: storage sign failed and service role is unavailable",
    );
    return null;
  }

  try {
    const admin = createServiceRoleClient();
    return await mintSignedUrl(admin, path);
  } catch (err) {
    console.error(
      "signAuthorizedAvatarPath: service-role sign failed",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Resolve a displayable image URL for the current viewer (self profile).
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

  if (profile.avatar_preference === "custom" && profile.avatar_path) {
    const signedUrl = await signAuthorizedAvatarPath(profile.avatar_path);
    if (!signedUrl) {
      console.error("resolveAvatarSrc: failed to mint signed avatar URL");
      return null;
    }
    return signedUrl;
  }

  // Preference google/custom but source missing → initials fallback
  return null;
}

/**
 * Build a display src from already-gated social fields.
 * Prefer google URL when present; otherwise sign a custom storage path.
 */
export async function resolveSocialAvatarSrc(input: {
  canView: boolean;
  preference: AvatarPreference | string;
  googleAvatarUrl: string | null | undefined;
  storagePath: string | null | undefined;
}): Promise<string | null> {
  if (!input.canView) return null;

  const googleUrl = input.googleAvatarUrl?.trim() || null;
  if (googleUrl) {
    return resolveVisibleAvatarSrc({
      canView: true,
      preference: "google",
      googleAvatarUrl: googleUrl,
      signedCustomUrl: null,
    });
  }

  if (input.storagePath) {
    const signed = await signAuthorizedAvatarPath(input.storagePath);
    return resolveVisibleAvatarSrc({
      canView: true,
      preference: "custom",
      googleAvatarUrl: null,
      signedCustomUrl: signed,
    });
  }

  if (input.preference === "initials") return null;
  return null;
}
