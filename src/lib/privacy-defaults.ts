import type { SocialVisibility } from "@/lib/social";
import type { AvatarVisibility } from "@/types/database";

/**
 * Privacy + social defaults applied to newly registered Studi accounts.
 * Existing accounts keep whatever they already saved — never backfilled.
 */
export const NEW_ACCOUNT_PRIVACY_DEFAULTS = {
  avatar_visibility: "public" as AvatarVisibility,
  online_status_visibility: "friends" as SocialVisibility,
  study_status_visibility: "friends" as SocialVisibility,
  stats_visibility: "friends" as SocialVisibility,
  discoverable: true,
  /** Written to gamification_preferences for new accounts only. */
  leaderboard_opt_in: true,
} as const;

/** Profile columns set on signup / ensure-profile (excludes gamification). */
export function newAccountProfilePrivacyFields() {
  return {
    avatar_visibility: NEW_ACCOUNT_PRIVACY_DEFAULTS.avatar_visibility,
    online_status_visibility:
      NEW_ACCOUNT_PRIVACY_DEFAULTS.online_status_visibility,
    study_status_visibility: NEW_ACCOUNT_PRIVACY_DEFAULTS.study_status_visibility,
    stats_visibility: NEW_ACCOUNT_PRIVACY_DEFAULTS.stats_visibility,
    discoverable: NEW_ACCOUNT_PRIVACY_DEFAULTS.discoverable,
  };
}

export function newAccountGamificationDefaults() {
  return {
    enabled: true,
    leaderboard_opt_in: NEW_ACCOUNT_PRIVACY_DEFAULTS.leaderboard_opt_in,
    achievement_notifications: true,
    accept_challenge_invites: true,
  };
}

/**
 * Legacy in-app fallback when a gamification_preferences row is missing.
 * Kept opt-out so existing users without a row are not silently opted in.
 */
export const LEGACY_MISSING_GAMIFICATION_LEADERBOARD_OPT_IN = false;

export type StoredPrivacySnapshot = {
  avatar_visibility: AvatarVisibility;
  online_status_visibility: SocialVisibility;
  study_status_visibility: SocialVisibility;
  stats_visibility: SocialVisibility;
  discoverable: boolean;
  leaderboard_opt_in: boolean;
};

/** Simulates applying only column DEFAULT changes (no UPDATE of existing rows). */
export function applyNewAccountDefaultsMigration(
  existing: StoredPrivacySnapshot | null,
): StoredPrivacySnapshot {
  if (existing) {
    // Existing rows are never rewritten by DEFAULT-only migrations.
    return { ...existing };
  }
  return {
    avatar_visibility: NEW_ACCOUNT_PRIVACY_DEFAULTS.avatar_visibility,
    online_status_visibility:
      NEW_ACCOUNT_PRIVACY_DEFAULTS.online_status_visibility,
    study_status_visibility: NEW_ACCOUNT_PRIVACY_DEFAULTS.study_status_visibility,
    stats_visibility: NEW_ACCOUNT_PRIVACY_DEFAULTS.stats_visibility,
    discoverable: NEW_ACCOUNT_PRIVACY_DEFAULTS.discoverable,
    leaderboard_opt_in: NEW_ACCOUNT_PRIVACY_DEFAULTS.leaderboard_opt_in,
  };
}

export const NEW_ACCOUNT_PRIVACY_ONBOARDING_SUMMARY = [
  {
    label: "Avatar",
    value: "Public",
    detail: "Other students on Studi can see your photo or initials.",
  },
  {
    label: "Online & study status",
    value: "Friends",
    detail: "Only accepted friends see when you’re online, focusing, or on a break.",
  },
  {
    label: "Study statistics",
    value: "Friends",
    detail: "Accepted friends can see aggregate weekly focus hours — never tasks or exams.",
  },
  {
    label: "Discoverability",
    value: "On",
    detail: "Your username can appear in search. Friends leaderboard is on by default.",
  },
] as const;
