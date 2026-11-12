import "server-only";

import { cache } from "react";

import { AVATAR_BUCKET, AVATAR_SIGNED_URL_TTL_SECONDS } from "@/lib/avatar";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  RoomMemberProfile,
  StudyRoom,
  StudyRoomInvitation,
  StudyRoomMessage,
  StudyRoomTimerState,
} from "@/lib/study-together/types";
import type { AccentColor } from "@/lib/theme";
import type { AvatarPreference } from "@/types/database";

async function signAvatarPath(path: string | null | undefined) {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function profileCard(userId: string): Promise<{
  username: string;
  display_name: string | null;
  accent_color: AccentColor;
  avatar_preference: AvatarPreference;
  avatarSrc: string | null;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_social_profile_by_id", {
    target_id: userId,
  });
  if (!data || typeof data !== "object") return null;
  const raw = data as {
    username: string;
    display_name: string | null;
    accent_color: string;
    avatar: {
      preference: string;
      google_avatar_url: string | null;
      can_view: boolean;
      storage_path?: string | null;
    };
  };
  let avatarSrc: string | null = null;
  if (raw.avatar?.can_view) {
    if (raw.avatar.preference === "google" && raw.avatar.google_avatar_url) {
      avatarSrc = raw.avatar.google_avatar_url;
    } else if (raw.avatar.storage_path) {
      avatarSrc = await signAvatarPath(raw.avatar.storage_path);
    }
  }
  return {
    username: raw.username,
    display_name: raw.display_name,
    accent_color: raw.accent_color as AccentColor,
    avatar_preference: raw.avatar.preference as AvatarPreference,
    avatarSrc,
  };
}

export type HubRoomCard = {
  room: StudyRoom;
  memberCount: number;
  isHost: boolean;
  hostUsername: string | null;
};

export const getStudyTogetherHub = cache(async () => {
  const user = await getSessionUser();
  if (!user) {
    return {
      myRooms: [] as HubRoomCard[],
      friendRooms: [] as HubRoomCard[],
      invitations: [] as Array<
        StudyRoomInvitation & {
          roomName: string;
          inviterUsername: string;
        }
      >,
      recentRooms: [] as HubRoomCard[],
      pendingInviteCount: 0,
    };
  }

  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("study_room_members")
    .select("room_id, role, status, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const activeRoomIds = (memberships ?? [])
    .filter((m) => m.status === "active")
    .map((m) => m.room_id);
  const recentRoomIds = (memberships ?? []).map((m) => m.room_id);

  const userId = user.id;

  async function loadRooms(ids: string[]): Promise<HubRoomCard[]> {
    if (ids.length === 0) return [];
    const { data: rooms } = await supabase
      .from("study_rooms")
      .select("*")
      .in("id", ids);
    const out: HubRoomCard[] = [];
    for (const room of rooms ?? []) {
      const { count } = await supabase
        .from("study_room_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("status", "active");
      const host = await profileCard(room.host_id);
      out.push({
        room: room as StudyRoom,
        memberCount: count ?? 0,
        isHost: room.host_id === userId,
        hostUsername: host?.username ?? null,
      });
    }
    return out;
  }

  const myRooms = (await loadRooms(activeRoomIds)).filter(
    (r) => r.room.status === "active",
  );
  const recentRooms = (await loadRooms(recentRoomIds)).slice(0, 8);

  const { data: friendList } = await supabase.rpc("list_my_friends");
  const friendIds = (friendList ?? []).map((f) => f.id);

  let friendRooms: HubRoomCard[] = [];
  if (friendIds.length > 0) {
    const { data: fr } = await supabase
      .from("study_rooms")
      .select("*")
      .eq("status", "active")
      .eq("visibility", "friends")
      .in("host_id", friendIds)
      .order("created_at", { ascending: false })
      .limit(20);
    const filtered = (fr ?? []).filter((r) => !activeRoomIds.includes(r.id));
    friendRooms = await loadRooms(filtered.map((r) => r.id));
  }

  const { data: invites } = await supabase
    .from("study_room_invitations")
    .select("*")
    .eq("invitee_id", user.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const invitations = [];
  for (const inv of invites ?? []) {
    const { data: room } = await supabase
      .from("study_rooms")
      .select("name")
      .eq("id", inv.room_id)
      .maybeSingle();
    const inviter = await profileCard(inv.inviter_id);
    invitations.push({
      ...(inv as StudyRoomInvitation),
      roomName: room?.name ?? "Study room",
      inviterUsername: inviter?.username ?? "someone",
    });
  }

  return {
    myRooms,
    friendRooms,
    invitations,
    recentRooms,
    pendingInviteCount: invitations.length,
  };
});

export const getStudyRoomBundle = cache(async (roomId: string) => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: room, error } = await supabase
    .from("study_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error || !room) return null;

  const { data: membership } = await supabase
    .from("study_room_members")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership && room.status === "active") {
    // May still see friends room listing metadata via RLS without membership
    return {
      room: room as StudyRoom,
      membership: null,
      isMember: false,
      isHost: false,
      timer: null as StudyRoomTimerState | null,
      members: [] as RoomMemberProfile[],
      messages: [] as StudyRoomMessage[],
      serverNow: new Date().toISOString(),
    };
  }

  if (!membership) return null;

  // Reconcile timer on member load (idempotent phase advance)
  await supabase.rpc("reconcile_room_timer", { p_room_id: roomId });

  const { data: timer } = await supabase
    .from("study_room_timer_state")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();

  const { data: memberRows } = await supabase
    .from("study_room_members")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  const members: RoomMemberProfile[] = [];
  for (const row of memberRows ?? []) {
    const profile = await profileCard(row.user_id);
    if (!profile) continue;
    members.push({
      id: row.user_id,
      username: profile.username,
      display_name: profile.display_name,
      accent_color: profile.accent_color,
      avatar_preference: profile.avatar_preference,
      avatarSrc: profile.avatarSrc,
      role: row.role,
      isHost: room.host_id === row.user_id,
    });
  }

  const { data: messages } = await supabase
    .from("study_room_messages")
    .select("*")
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);

  return {
    room: room as StudyRoom,
    membership,
    isMember: true,
    isHost: room.host_id === user.id,
    timer: (timer as StudyRoomTimerState) ?? null,
    members,
    messages: ((messages ?? []) as StudyRoomMessage[]).reverse(),
    serverNow: new Date().toISOString(),
  };
});
