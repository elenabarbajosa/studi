"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Ban, Check, MoreHorizontal, UserMinus, UserPlus, UserRound, X } from "lucide-react";
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
import { primaryPillClass, softPillClass } from "@/components/studi/page-title";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDurationMinutes } from "@/lib/focus/timer-engine";
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

const PRESENCE_DOT: Record<PresenceStatus, string> = {
  focusing: "bg-accent-ink dark:bg-accent",
  on_break: "bg-warning",
  online: "bg-success",
  offline: "bg-ink-4",
};

const iconAction =
  "flex size-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50";

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
  const name = displayName || username;
  const live = presenceStatus && presenceStatus !== "offline";

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

  function remove() {
    if (!confirm(`Remove @${username} from friends?`)) return;
    run(() => removeFriend(id));
  }

  function block() {
    if (!confirm(`Block @${username}?`)) return;
    run(() => blockUser(id));
  }

  const meta = [
    `@${username}`,
    live ? presenceLabel(presenceStatus) : null,
    weeklyFocusSeconds != null ? `${formatDurationMinutes(weeklyFocusSeconds * 1000)} this week` : null,
  ].filter(Boolean);

  const showMenu = friendshipStatus === "friends" || showBlock;

  return (
    <div className="flex items-center gap-3 rounded-[18px] px-2.5 py-2.5 transition-colors hover:bg-hover/60">
      <Link
        href={`/u/${username}`}
        className="relative shrink-0 rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
        tabIndex={-1}
        aria-hidden
      >
        <StudiAvatar profile={profileFields} src={avatarSrc} size={42} />
        {live ? (
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full shadow-[0_0_0_2.5px_var(--raised)]",
              PRESENCE_DOT[presenceStatus],
            )}
          />
        ) : null}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/u/${username}`}
          className="block truncate rounded text-[14.5px] font-semibold text-ink outline-none hover:underline focus-visible:shadow-[0_0_0_2px_var(--accent)]"
        >
          {name}
        </Link>
        <p className="truncate text-[12.5px] text-ink-3">
          {meta.map((m, i) => (
            <span key={i} className={cn(i === 1 && live && "font-medium text-accent-text")}>
              {i > 0 ? " · " : ""}
              {m}
            </span>
          ))}
        </p>
        {bio ? <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-2">{bio}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {friendshipStatus === "none" ? (
          <button
            type="button"
            className={cn(primaryPillClass, "h-9 px-3.5 md:h-8")}
            disabled={isPending}
            onClick={() => run(() => sendFriendRequest(username))}
          >
            <UserPlus className="size-3.5" aria-hidden />
            Add
          </button>
        ) : null}
        {friendshipStatus === "outgoing" && requestId ? (
          <button
            type="button"
            className={softPillClass}
            disabled={isPending}
            onClick={() => run(() => cancelFriendRequest(requestId))}
          >
            Cancel
          </button>
        ) : null}
        {friendshipStatus === "outgoing" && !requestId ? (
          <span className="px-2 text-[12.5px] text-ink-3">Requested</span>
        ) : null}
        {friendshipStatus === "incoming" && requestId ? (
          <>
            <button
              type="button"
              aria-label={`Decline @${username}`}
              className={cn(iconAction, "bg-sunken text-ink-2 hover:bg-hover hover:text-ink")}
              disabled={isPending}
              onClick={() => run(() => declineFriendRequest(requestId))}
            >
              <X className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Accept @${username}`}
              className={cn(
                iconAction,
                "bg-primary text-primary-foreground hover:bg-accent-ink-hover dark:bg-accent dark:text-ink-on-accent",
              )}
              disabled={isPending}
              onClick={() => run(() => acceptFriendRequest(requestId))}
            >
              <Check className="size-4" aria-hidden />
            </button>
          </>
        ) : null}
        {showMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`More for @${username}`}
              disabled={isPending}
              className={cn(iconAction, "text-ink-3 hover:bg-sunken hover:text-ink")}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem render={<Link href={`/u/${username}`} />}>
                <UserRound aria-hidden />
                View profile
              </DropdownMenuItem>
              {friendshipStatus === "friends" ? (
                <DropdownMenuItem onClick={remove}>
                  <UserMinus aria-hidden />
                  Remove friend
                </DropdownMenuItem>
              ) : null}
              {showBlock ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={block}>
                    <Ban aria-hidden />
                    Block
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
