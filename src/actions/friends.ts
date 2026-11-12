"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSocialVisibility, type SocialVisibility } from "@/lib/social";
import type { AvatarVisibility } from "@/types/database";

export type FriendActionState = {
  error?: string;
  success?: string;
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

function revalidateSocial(username?: string) {
  revalidatePath("/friends");
  revalidatePath("/dashboard");
  if (username) revalidatePath(`/u/${username}`);
}

export async function sendFriendRequest(
  username: string,
): Promise<FriendActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.rpc("send_friend_request", {
    target_username: username.trim(),
  });

  if (error) return { error: error.message };
  revalidateSocial(username);
  return { success: "Friend request sent" };
}

export async function acceptFriendRequest(
  requestId: string,
): Promise<FriendActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.rpc("accept_friend_request", {
    request_id: requestId,
  });

  if (error) return { error: error.message };
  revalidateSocial();
  return { success: "Friend request accepted" };
}

export async function declineFriendRequest(
  requestId: string,
): Promise<FriendActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("friend_requests")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("recipient_id", auth.user.id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidateSocial();
  return { success: "Request declined" };
}

export async function cancelFriendRequest(
  requestId: string,
): Promise<FriendActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("friend_requests")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("requester_id", auth.user.id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidateSocial();
  return { success: "Request cancelled" };
}

export async function removeFriend(
  friendUserId: string,
): Promise<FriendActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.rpc("remove_friend", {
    friend_user_id: friendUserId,
  });

  if (error) return { error: error.message };
  revalidateSocial();
  return { success: "Friend removed" };
}

export async function blockUser(
  targetUserId: string,
): Promise<FriendActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.rpc("block_user", {
    target_user_id: targetUserId,
  });

  if (error) return { error: error.message };
  revalidateSocial();
  return { success: "User blocked" };
}

export async function unblockUser(
  targetUserId: string,
): Promise<FriendActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", auth.user.id)
    .eq("blocked_id", targetUserId);

  if (error) return { error: error.message };
  revalidateSocial();
  return { success: "User unblocked" };
}

export async function updateSocialPrivacy(input: {
  discoverable: boolean;
  avatar_visibility: AvatarVisibility;
  online_status_visibility: SocialVisibility;
  study_status_visibility: SocialVisibility;
  stats_visibility: SocialVisibility;
}): Promise<FriendActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  if (
    !isSocialVisibility(input.online_status_visibility) ||
    !isSocialVisibility(input.study_status_visibility) ||
    !isSocialVisibility(input.stats_visibility)
  ) {
    return { error: "Invalid visibility setting" };
  }

  if (
    input.avatar_visibility !== "private" &&
    input.avatar_visibility !== "friends" &&
    input.avatar_visibility !== "public"
  ) {
    return { error: "Invalid avatar visibility" };
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      discoverable: input.discoverable,
      avatar_visibility: input.avatar_visibility,
      online_status_visibility: input.online_status_visibility,
      study_status_visibility: input.study_status_visibility,
      stats_visibility: input.stats_visibility,
    })
    .eq("id", auth.user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/friends");
  return { success: "Privacy settings saved" };
}
