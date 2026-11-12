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
import { presenceLabel, type SocialProfile } from "@/lib/social";
import type { AccentColor } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { AvatarPreference } from "@/types/database";

type SocialProfileViewProps = {
  profile: SocialProfile;
  requestId?: string | null;
  isOwner: boolean;
};

function formatHours(seconds: number) {
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(seconds / 60)} minutes this week`;
  return `${h.toFixed(1)} hours this week`;
}

export function SocialProfileView({
  profile,
  requestId,
  isOwner,
}: SocialProfileViewProps) {
  const [isPending, startTransition] = useTransition();
  const status = profile.friendship_status;

  const avatarProfile = {
    display_name: profile.display_name,
    username: profile.username,
    accent_color: profile.accent_color as AccentColor,
    avatar_preference: profile.avatar.preference as AvatarPreference,
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
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="studi-panel flex flex-col items-center gap-4 p-8 text-center sm:p-10">
        <StudiAvatar
          profile={avatarProfile}
          src={profile.avatarSrc}
          size="xl"
          showOnline={Boolean(
            profile.presence && profile.presence.status !== "offline",
          )}
          online={
            profile.presence?.status === "focusing" ||
            profile.presence?.status === "on_break" ||
            profile.presence?.status === "online"
          }
        />
        <div>
          <h1 className="font-display text-3xl tracking-tight">
            {profile.display_name || profile.username}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            @{profile.username}
          </p>
        </div>
        {profile.bio ? (
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {profile.bio}
          </p>
        ) : null}

        {profile.presence && profile.presence.status !== "offline" ? (
          <p className="text-sm text-primary">
            {presenceLabel(profile.presence.status)}
            {profile.presence.activity_label
              ? ` · ${profile.presence.activity_label}`
              : ""}
          </p>
        ) : null}

        {profile.stats ? (
          <p className="text-sm text-muted-foreground">
            {formatHours(profile.stats.weekly_focus_seconds)}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {isOwner ? (
            <Link
              href="/settings"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Edit profile
            </Link>
          ) : null}

          {!isOwner && status === "none" ? (
            <Button
              type="button"
              disabled={isPending}
              onClick={() => run(() => sendFriendRequest(profile.username))}
            >
              Add friend
            </Button>
          ) : null}

          {!isOwner && status === "outgoing" && requestId ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => cancelFriendRequest(requestId))}
            >
              Cancel request
            </Button>
          ) : null}

          {!isOwner && status === "outgoing" && !requestId ? (
            <span className="text-sm text-muted-foreground">Request sent</span>
          ) : null}

          {!isOwner && status === "incoming" && requestId ? (
            <>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => run(() => acceptFriendRequest(requestId))}
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => declineFriendRequest(requestId))}
              >
                Decline
              </Button>
            </>
          ) : null}

          {!isOwner && status === "friends" ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                if (!confirm(`Remove @${profile.username} from friends?`))
                  return;
                run(() => removeFriend(profile.id));
              }}
            >
              Remove friend
            </Button>
          ) : null}

          {!isOwner ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                if (!confirm(`Block @${profile.username}?`)) return;
                run(() => blockUser(profile.id));
              }}
            >
              Block
            </Button>
          ) : null}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Private calendar events, exams, tasks, and notes are never shown here.
      </p>
    </div>
  );
}
