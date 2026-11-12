import "server-only";

import { cache } from "react";

import { AVATAR_BUCKET, AVATAR_SIGNED_URL_TTL_SECONDS } from "@/lib/avatar";
import { getSessionUser } from "@/lib/auth";
import {
  type DiscoverableProfile,
  type FriendshipStatus,
  type PresenceStatus,
  type SocialProfile,
} from "@/lib/social";
import { createClient } from "@/lib/supabase/server";
import type { AccentColor } from "@/lib/theme";
import type {
  AvatarPreference,
  AvatarVisibility,
  FriendRequest,
} from "@/types/database";

async function signAvatarPath(path: string | null | undefined) {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function parseSocialJson(data: unknown): SocialProfile | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as {
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
      storage_path?: string | null;
    };
    stats: { weekly_focus_seconds: number } | null;
    presence: {
      status: PresenceStatus;
      activity_label: string | null;
      updated_at: string;
    } | null;
  };

  return {
    id: raw.id,
    username: raw.username,
    display_name: raw.display_name,
    bio: raw.bio,
    accent_color: raw.accent_color,
    friendship_status: raw.friendship_status,
    discoverable: raw.discoverable,
    avatar: {
      preference: raw.avatar.preference,
      visibility: raw.avatar.visibility,
      has_custom: raw.avatar.has_custom,
      google_avatar_url: raw.avatar.google_avatar_url,
      can_view: raw.avatar.can_view,
    },
    avatarSrc: null,
    stats: raw.stats,
    presence: raw.presence,
  };
}

async function withSignedAvatar(
  profile: SocialProfile,
  storagePath?: string | null,
): Promise<SocialProfile> {
  let avatarSrc: string | null = null;
  if (profile.avatar.can_view) {
    if (
      profile.avatar.preference === "google" &&
      profile.avatar.google_avatar_url
    ) {
      avatarSrc = profile.avatar.google_avatar_url;
    } else if (storagePath) {
      avatarSrc = await signAvatarPath(storagePath);
    }
  }
  return { ...profile, avatarSrc };
}

export const searchUsers = cache(
  async (
    query: string,
    limit = 20,
    offset = 0,
  ): Promise<DiscoverableProfile[]> => {
    const user = await getSessionUser();
    if (!user || !query.trim()) return [];

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_discoverable_profiles", {
      query: query.trim(),
      result_limit: limit,
      result_offset: offset,
    });

    if (error) {
      console.error("searchUsers:", error.message);
      return [];
    }

    return Promise.all(
      (data ?? []).map(async (row) => {
        let avatarSrc: string | null = row.google_avatar_url;
        if (!avatarSrc && row.storage_path) {
          avatarSrc = await signAvatarPath(row.storage_path);
        }
        return {
          id: row.id,
          username: row.username,
          display_name: row.display_name,
          accent_color: row.accent_color,
          avatar_preference: row.avatar_preference,
          avatar_visibility: row.avatar_visibility,
          google_avatar_url: row.google_avatar_url,
          has_custom_avatar: row.has_custom_avatar,
          friendship_status:
            row.friendship_status as DiscoverableProfile["friendship_status"],
          request_id: row.request_id ?? null,
          bio: row.bio,
          avatarSrc,
        };
      }),
    );
  },
);

export const getSocialProfileByUsername = cache(
  async (username: string): Promise<SocialProfile | null> => {
    const user = await getSessionUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_social_profile", {
      target_username: username,
    });

    if (error) {
      console.error("getSocialProfileByUsername:", error.message);
      return null;
    }

    const parsed = parseSocialJson(data);
    if (!parsed) return null;
    const storagePath =
      data && typeof data === "object"
        ? ((data as { avatar?: { storage_path?: string | null } }).avatar
            ?.storage_path ?? null)
        : null;
    return withSignedAvatar(parsed, storagePath);
  },
);

export type FriendListItem = {
  id: string;
  username: string;
  display_name: string | null;
  accent_color: AccentColor;
  avatar_preference: AvatarPreference;
  avatar_visibility: AvatarVisibility;
  avatarSrc: string | null;
  presenceStatus: PresenceStatus;
  presenceLabel: string | null;
  weeklyFocusSeconds: number | null;
};

export const listFriends = cache(async (): Promise<FriendListItem[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_friends");

  if (error) {
    console.error("listFriends:", error.message);
    return [];
  }

  return Promise.all(
    (data ?? []).map(async (row) => {
      let avatarSrc: string | null = null;
      if (row.can_view_avatar) {
        if (row.google_avatar_url) avatarSrc = row.google_avatar_url;
        else if (row.storage_path)
          avatarSrc = await signAvatarPath(row.storage_path);
      }
      return {
        id: row.id,
        username: row.username,
        display_name: row.display_name,
        accent_color: row.accent_color,
        avatar_preference: row.avatar_preference,
        avatar_visibility: row.avatar_visibility,
        avatarSrc,
        presenceStatus: (row.presence_status ?? "offline") as PresenceStatus,
        presenceLabel: row.presence_label,
        weeklyFocusSeconds:
          row.weekly_focus_seconds == null
            ? null
            : Number(row.weekly_focus_seconds),
      };
    }),
  );
});

export type RequestListItem = {
  request: FriendRequest;
  username: string;
  display_name: string | null;
  accent_color: AccentColor;
  avatar_preference: AvatarPreference;
  avatarSrc: string | null;
};

async function hydrateRequests(
  rows: FriendRequest[],
  otherField: "requester_id" | "recipient_id",
): Promise<RequestListItem[]> {
  const supabase = await createClient();
  const out: RequestListItem[] = [];

  for (const request of rows) {
    const otherId = request[otherField];
    const { data, error } = await supabase.rpc("get_social_profile_by_id", {
      target_id: otherId,
    });
    if (error || !data) continue;

    const parsed = parseSocialJson(data);
    if (!parsed) continue;
    const storagePath =
      typeof data === "object"
        ? ((data as { avatar?: { storage_path?: string | null } }).avatar
            ?.storage_path ?? null)
        : null;
    const withAvatar = await withSignedAvatar(parsed, storagePath);

    out.push({
      request,
      username: withAvatar.username,
      display_name: withAvatar.display_name,
      accent_color: withAvatar.accent_color as AccentColor,
      avatar_preference: withAvatar.avatar.preference as AvatarPreference,
      avatarSrc: withAvatar.avatarSrc,
    });
  }

  return out;
}

export const listIncomingRequests = cache(
  async (): Promise<RequestListItem[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("recipient_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listIncomingRequests:", error.message);
      return [];
    }

    return hydrateRequests(data ?? [], "requester_id");
  },
);

export const listOutgoingRequests = cache(
  async (): Promise<RequestListItem[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("requester_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listOutgoingRequests:", error.message);
      return [];
    }

    return hydrateRequests(data ?? [], "recipient_id");
  },
);

export const getPendingRequestId = cache(
  async (otherUserId: string): Promise<string | null> => {
    const user = await getSessionUser();
    if (!user) return null;
    const supabase = await createClient();

    const { data: outgoing } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("status", "pending")
      .eq("requester_id", user.id)
      .eq("recipient_id", otherUserId)
      .maybeSingle();
    if (outgoing?.id) return outgoing.id;

    const { data: incoming } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("status", "pending")
      .eq("requester_id", otherUserId)
      .eq("recipient_id", user.id)
      .maybeSingle();
    return incoming?.id ?? null;
  },
);

export const getFriendsDashboard = cache(async () => {
  const [friends, incoming, outgoing] = await Promise.all([
    listFriends(),
    listIncomingRequests(),
    listOutgoingRequests(),
  ]);

  const studying = friends.filter(
    (f) => f.presenceStatus === "focusing" || f.presenceStatus === "on_break",
  );

  return {
    friends,
    incoming,
    outgoing,
    studying,
    friendCount: friends.length,
    pendingIncoming: incoming.length,
    pendingOutgoing: outgoing.length,
  };
});
