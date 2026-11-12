export const SOCIAL_VISIBILITIES = ["private", "friends", "public"] as const;
export type SocialVisibility = (typeof SOCIAL_VISIBILITIES)[number];

export const FRIENDSHIP_STATUSES = [
  "self",
  "friends",
  "outgoing",
  "incoming",
  "none",
] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

export const PRESENCE_STATUSES = [
  "offline",
  "online",
  "focusing",
  "on_break",
] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export const FRIEND_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
] as const;
export type FriendRequestStatus = (typeof FRIEND_REQUEST_STATUSES)[number];

export function isSocialVisibility(v: unknown): v is SocialVisibility {
  return (
    typeof v === "string" &&
    (SOCIAL_VISIBILITIES as readonly string[]).includes(v)
  );
}

export function isPresenceStatus(v: unknown): v is PresenceStatus {
  return (
    typeof v === "string" &&
    (PRESENCE_STATUSES as readonly string[]).includes(v)
  );
}

export type DiscoverableProfile = {
  id: string;
  username: string;
  display_name: string | null;
  accent_color: string;
  avatar_preference: string;
  avatar_visibility: string;
  google_avatar_url: string | null;
  has_custom_avatar: boolean;
  friendship_status: "friends" | "outgoing" | "incoming" | "none";
  request_id: string | null;
  bio: string | null;
  avatarSrc?: string | null;
};

export type SocialProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  accent_color: string;
  friendship_status: FriendshipStatus;
  discoverable: boolean;
  avatar: {
    preference: string;
    visibility: string;
    has_custom: boolean;
    google_avatar_url: string | null;
    can_view: boolean;
  };
  avatarSrc: string | null;
  stats: { weekly_focus_seconds: number } | null;
  presence: {
    status: PresenceStatus;
    activity_label: string | null;
    updated_at: string;
  } | null;
};

export function presenceLabel(status: PresenceStatus) {
  switch (status) {
    case "focusing":
      return "Focusing";
    case "on_break":
      return "On break";
    case "online":
      return "Online";
    default:
      return "Offline";
  }
}
