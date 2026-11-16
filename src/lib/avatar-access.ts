import type { AvatarPreference, AvatarVisibility } from "@/types/database";

/** UUID folder + single filename segment (matches buildAvatarObjectPath). */
const AVATAR_OBJECT_PATH_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[^/]+$/i;

export type AvatarAccessInput = {
  viewerId: string | null | undefined;
  ownerId: string;
  visibility: AvatarVisibility;
  areFriends: boolean;
  isBlocked: boolean;
};

/**
 * Who may see another user's profile photo.
 * Owners always see their own photo regardless of visibility.
 */
export function canViewerSeeAvatar(input: AvatarAccessInput): boolean {
  const viewerId = input.viewerId?.trim() || null;
  if (!viewerId) return false;
  if (viewerId === input.ownerId) return true;
  if (input.isBlocked) return false;
  if (input.visibility === "public") return true;
  if (input.visibility === "friends") return input.areFriends;
  return false;
}

export type ResolveVisibleAvatarSrcInput = {
  canView: boolean;
  preference: AvatarPreference | string;
  googleAvatarUrl: string | null | undefined;
  signedCustomUrl: string | null | undefined;
};

/**
 * Map preference + authorization into a displayable image URL.
 * Returns null → callers should render initials.
 */
export function resolveVisibleAvatarSrc(
  input: ResolveVisibleAvatarSrcInput,
): string | null {
  if (!input.canView) return null;

  if (input.preference === "google") {
    const url = input.googleAvatarUrl?.trim();
    return url || null;
  }

  if (input.preference === "custom") {
    const url = input.signedCustomUrl?.trim();
    return url || null;
  }

  return null;
}

/** True when path looks like `{ownerUuid}/{filename}` for the avatars bucket. */
export function isAvatarStoragePath(path: string | null | undefined): boolean {
  if (!path) return false;
  return AVATAR_OBJECT_PATH_RE.test(path);
}

/** Owner user id from a validated avatar object path, else null. */
export function ownerIdFromAvatarPath(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const match = AVATAR_OBJECT_PATH_RE.exec(path);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * After an avatar is removed or rotated, previous signed URLs and cached
 * listings must be treated as stale. Callers revalidate these app paths.
 */
export const AVATAR_REVALIDATE_PATHS = [
  "/settings",
  "/dashboard",
  "/friends",
  "/progress",
] as const;
