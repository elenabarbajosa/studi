"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Ban, Check, ChevronLeft, Clock, Lock, Pencil, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/actions/friends";
import { Tile } from "@/components/dashboard/tile";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { primaryPillClass, softPillClass } from "@/components/studi/page-title";
import { formatDurationMinutes } from "@/lib/focus/timer-engine";
import { presenceLabel, type PresenceStatus, type SocialProfile } from "@/lib/social";
import type { AccentColor } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { AvatarPreference } from "@/types/database";

type SocialProfileViewProps = {
  profile: SocialProfile;
  requestId?: string | null;
  isOwner: boolean;
};

const PRESENCE_CHIP: Record<Exclude<PresenceStatus, "offline">, string> = {
  focusing: "bg-accent-soft text-accent-text",
  on_break: "bg-warning-soft text-warning",
  online: "bg-success-soft text-success",
};

const PRESENCE_DOT: Record<Exclude<PresenceStatus, "offline">, string> = {
  focusing: "bg-accent-ink dark:bg-accent",
  on_break: "bg-warning",
  online: "bg-success",
};

const ghostPillClass =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold text-ink-2 outline-none transition-colors duration-200 ease-studi hover:bg-sunken hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50 md:h-9";

export function SocialProfileView({
  profile,
  requestId,
  isOwner,
}: SocialProfileViewProps) {
  const [isPending, startTransition] = useTransition();
  const status = profile.friendship_status;
  const presence =
    profile.presence && profile.presence.status !== "offline" ? profile.presence : null;
  const presenceStatus = presence?.status as Exclude<PresenceStatus, "offline"> | undefined;

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
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 md:gap-5">
      <Link
        href="/friends"
        className="inline-flex w-fit items-center gap-1 rounded-md text-[13.5px] font-medium text-ink-2 outline-none transition-colors hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent)]"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Friends
      </Link>

      <Tile variant="hero" className="flex flex-col items-center gap-4 px-5 pt-8 pb-6 text-center md:px-10 md:pt-10 md:pb-8">
        <div className="relative">
          <StudiAvatar profile={avatarProfile} src={profile.avatarSrc} size={104} className="shadow-[0_0_0_4px_var(--raised)]" />
          {presenceStatus ? (
            <span
              className={cn(
                "absolute right-1 bottom-1 size-5 rounded-full shadow-[0_0_0_3.5px_var(--accent-soft)]",
                PRESENCE_DOT[presenceStatus],
              )}
              aria-hidden
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink md:text-[32px]">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-[14px] text-ink-2">@{profile.username}</p>
        </div>

        {presenceStatus || profile.stats ? (
          <div className="flex flex-wrap justify-center gap-2">
            {presenceStatus ? (
              <span
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold",
                  PRESENCE_CHIP[presenceStatus],
                )}
              >
                <span className={cn("size-1.5 rounded-full", PRESENCE_DOT[presenceStatus])} aria-hidden />
                {presenceLabel(presenceStatus)}
                {presence?.activity_label ? (
                  <span className="font-normal">· {presence.activity_label}</span>
                ) : null}
              </span>
            ) : null}
            {profile.stats ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-raised/70 px-3 text-[12.5px] font-semibold text-ink">
                <Clock className="size-3.5 text-ink-3" aria-hidden />
                {formatDurationMinutes(profile.stats.weekly_focus_seconds * 1000)} this week
              </span>
            ) : null}
          </div>
        ) : null}

        {profile.bio ? (
          <p className="max-w-md text-[14.5px] leading-relaxed text-ink-2">{profile.bio}</p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {isOwner ? (
            <Link href="/settings" className={softPillClass}>
              <Pencil className="size-3.5" aria-hidden />
              Edit profile
            </Link>
          ) : null}

          {!isOwner && status === "none" ? (
            <button
              type="button"
              className={primaryPillClass}
              disabled={isPending}
              onClick={() => run(() => sendFriendRequest(profile.username))}
            >
              <UserPlus className="size-4" aria-hidden />
              Add friend
            </button>
          ) : null}

          {!isOwner && status === "outgoing" && requestId ? (
            <button
              type="button"
              className={softPillClass}
              disabled={isPending}
              onClick={() => run(() => cancelFriendRequest(requestId))}
            >
              Cancel request
            </button>
          ) : null}

          {!isOwner && status === "outgoing" && !requestId ? (
            <span className="inline-flex h-9 items-center px-2 text-[13.5px] text-ink-2">Request sent</span>
          ) : null}

          {!isOwner && status === "incoming" && requestId ? (
            <>
              <button
                type="button"
                className={primaryPillClass}
                disabled={isPending}
                onClick={() => run(() => acceptFriendRequest(requestId))}
              >
                <Check className="size-4" aria-hidden />
                Accept
              </button>
              <button
                type="button"
                className={softPillClass}
                disabled={isPending}
                onClick={() => run(() => declineFriendRequest(requestId))}
              >
                <X className="size-4" aria-hidden />
                Decline
              </button>
            </>
          ) : null}

          {!isOwner && status === "friends" ? (
            <button
              type="button"
              className={softPillClass}
              disabled={isPending}
              onClick={() => {
                if (!confirm(`Remove @${profile.username} from friends?`)) return;
                run(() => removeFriend(profile.id));
              }}
            >
              <UserMinus className="size-4" aria-hidden />
              Remove friend
            </button>
          ) : null}

          {!isOwner ? (
            <button
              type="button"
              className={ghostPillClass}
              disabled={isPending}
              onClick={() => {
                if (!confirm(`Block @${profile.username}?`)) return;
                run(() => blockUser(profile.id));
              }}
            >
              <Ban className="size-4" aria-hidden />
              Block
            </button>
          ) : null}
        </div>
      </Tile>

      {!isOwner && status !== "friends" && !profile.stats && !presence ? (
        <Tile variant="data" className="flex items-start gap-3 p-4 md:p-5">
          <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Study activity is only visible to friends who {profile.display_name || profile.username} chooses to share it with.
          </p>
        </Tile>
      ) : null}

      <p className="px-2 text-center text-[12.5px] text-ink-3">
        <ShieldCheck className="mr-1.5 inline size-3.5 -translate-y-px align-middle" aria-hidden />
        Private calendar events, exams, tasks, and notes are never shown here.
      </p>
    </div>
  );
}
