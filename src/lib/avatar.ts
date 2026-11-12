import type { AccentColor } from "@/lib/theme";
import type { AvatarPreference, Profile } from "@/types/database";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 512;
export const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;

export const AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

export const AVATAR_PREFERENCES = ["custom", "google", "initials"] as const;
export const AVATAR_VISIBILITIES = ["private", "friends", "public"] as const;

export type AvatarSizeToken = "sm" | "md" | "lg" | "xl";

export const AVATAR_SIZE_PX: Record<AvatarSizeToken, number> = {
  sm: 28,
  md: 40,
  lg: 96,
  xl: 112,
};

export type ProfileAvatarFields = Pick<
  Profile,
  | "display_name"
  | "username"
  | "accent_color"
  | "avatar_preference"
  | "avatar_path"
  | "google_avatar_url"
>;

export function isAvatarPreference(v: unknown): v is AvatarPreference {
  return (
    typeof v === "string" &&
    (AVATAR_PREFERENCES as readonly string[]).includes(v)
  );
}

export function isAvatarMimeType(v: unknown): v is AvatarMimeType {
  return (
    typeof v === "string" &&
    (AVATAR_MIME_TYPES as readonly string[]).includes(v)
  );
}

/** Initials from display name or username (1–2 characters). */
export function avatarInitials(
  displayName: string | null | undefined,
  username: string,
) {
  const source = (displayName?.trim() || username).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

/** Soft pastel backgrounds keyed by accent — works in light and dark. */
export function avatarAccentClasses(accent: AccentColor) {
  const map: Record<AccentColor, string> = {
    pink: "bg-[oklch(0.90_0.05_10)] text-[oklch(0.42_0.08_10)] dark:bg-[oklch(0.35_0.05_10)] dark:text-[oklch(0.92_0.04_10)]",
    blue: "bg-[oklch(0.90_0.05_240)] text-[oklch(0.40_0.08_240)] dark:bg-[oklch(0.35_0.05_240)] dark:text-[oklch(0.92_0.04_240)]",
    green:
      "bg-[oklch(0.90_0.05_160)] text-[oklch(0.38_0.07_160)] dark:bg-[oklch(0.35_0.05_160)] dark:text-[oklch(0.92_0.04_160)]",
    purple:
      "bg-[oklch(0.90_0.05_300)] text-[oklch(0.40_0.08_300)] dark:bg-[oklch(0.35_0.05_300)] dark:text-[oklch(0.92_0.04_300)]",
    peach:
      "bg-[oklch(0.92_0.05_50)] text-[oklch(0.42_0.08_50)] dark:bg-[oklch(0.36_0.05_50)] dark:text-[oklch(0.93_0.04_50)]",
    neutral:
      "bg-[oklch(0.90_0.01_260)] text-[oklch(0.40_0.02_260)] dark:bg-[oklch(0.34_0.01_260)] dark:text-[oklch(0.90_0.01_260)]",
  };
  return map[accent];
}

/**
 * Detect image type from magic bytes (do not trust extension alone).
 */
export function detectImageMime(bytes: Uint8Array): AvatarMimeType | null {
  if (bytes.length < 12) return null;

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  const riff =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  const webp =
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (riff && webp) return "image/webp";

  return null;
}

export function extensionForMime(mime: AvatarMimeType) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function buildAvatarObjectPath(userId: string, mime: AvatarMimeType) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${id}.${extensionForMime(mime)}`;
}

/** Which remote image URL (if any) the preference model would show. */
export function preferredRemoteAvatarUrl(
  profile: ProfileAvatarFields,
): string | null {
  if (profile.avatar_preference === "custom") {
    // Custom uses Storage path + signed URL; not a permanent URL.
    return null;
  }
  if (
    profile.avatar_preference === "google" &&
    profile.google_avatar_url
  ) {
    return profile.google_avatar_url;
  }
  return null;
}

export function avatarLabel(profile: ProfileAvatarFields) {
  return profile.display_name?.trim() || profile.username;
}
