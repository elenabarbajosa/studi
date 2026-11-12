"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/actions/friends";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { presenceLabel, type PresenceStatus } from "@/lib/social";
import type { AccentColor } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { AvatarPreference } from "@/types/database";

type UserCardProps = {
  id: string;
  username: string;
  displayName: string | null;
  accentColor: AccentColor | string;
  avatarPreference?: AvatarPreference | string;
  avatarSrc?: string | null;
  bio?: string | null;
  friendshipStatus?: "friends" | "outgoing" | "incoming" | "none" | "self";
  presenceStatus?: PresenceStatus;
  weeklyFocusSeconds?: number | null;
  requestId?: string;
  showBlock?: boolean;
};

function formatHours(seconds: number) {
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(seconds / 60)}m this week`;
  return `${h.toFixed(1)}h this week`;
}

export function UserCard({
  id,
  username,
  displayName,
  accentColor,
  avatarPreference = "initials",
  avatarSrc = null,
  bio,
  friendshipStatus = "none",
  presenceStatus,
  weeklyFocusSeconds,
  requestId,
  showBlock = false,
}: UserCardProps) {
  const [isPending, startTransition] = useTransition();

  const profileFields = {
    display_name: displayName,
    username,
    accent_color: accentColor as AccentColor,
    avatar_preference: avatarPreference as AvatarPreference,
    avatar_path: null,
    google_avatar_url: null,
  };

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    });
  }

  return (
    <div className="studi-panel flex flex-wrap items-center gap-3 p-4">
      <Link href={`/u/${username}`} className="shrink-0">
        <StudiAvatar
          profile={profileFields}
          src={avatarSrc}
          size="md"
          showOnline={Boolean(
            presenceStatus &&
              presenceStatus !== "offline" &&
              presenceStatus !== undefined,
          )}
          online={
            presenceStatus === "focusing" ||
            presenceStatus === "on_break" ||
            presenceStatus === "online"
          }
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/u/${username}`}
          className="font-medium hover:underline"
        >
          {displayName || username}
        </Link>
        <p className="text-xs text-muted-foreground">@{username}</p>
        {bio ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {bio}
          </p>
        ) : null}
        {presenceStatus && presenceStatus !== "offline" ? (
          <p className="mt-1 text-xs text-primary">
            {presenceLabel(presenceStatus)}
          </p>
        ) : null}
        {weeklyFocusSeconds != null ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatHours(weeklyFocusSeconds)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {friendshipStatus === "none" ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => run(() => sendFriendRequest(username))}
          >
            Add friend
          </Button>
        ) : null}
        {friendshipStatus === "outgoing" && requestId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => cancelFriendRequest(requestId))}
          >
            Cancel
          </Button>
        ) : null}
        {friendshipStatus === "outgoing" && !requestId ? (
          <span className="text-xs text-muted-foreground">Request sent</span>
        ) : null}
        {friendshipStatus === "incoming" && requestId ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => acceptFriendRequest(requestId))}
            >
              Accept
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => declineFriendRequest(requestId))}
            >
              Decline
            </Button>
          </>
        ) : null}
        {friendshipStatus === "friends" ? (
          <>
            <Link
              href={`/u/${username}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Profile
            </Link>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                if (!confirm(`Remove @${username} from friends?`)) return;
                run(() => removeFriend(id));
              }}
            >
              Remove
            </Button>
          </>
        ) : null}
        {showBlock ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              if (!confirm(`Block @${username}?`)) return;
              run(() => blockUser(id));
            }}
          >
            Block
          </Button>
        ) : null}
      </div>
    </div>
  );
}
