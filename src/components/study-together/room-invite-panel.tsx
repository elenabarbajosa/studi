"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { inviteFriendToRoom } from "@/actions/study-together";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { softPillClass } from "@/components/studi/page-title";
import type { FriendListItem } from "@/lib/data/friends";

type RoomInvitePanelProps = {
  roomId: string;
  friends: FriendListItem[];
  memberIds: string[];
  canInvite: boolean;
};

export function RoomInvitePanel({
  roomId,
  friends,
  memberIds,
  canInvite,
}: RoomInvitePanelProps) {
  const [isPending, startTransition] = useTransition();
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(() => new Set());
  const candidates = friends.filter((f) => !memberIds.includes(f.id));

  if (!canInvite) {
    return (
      <p className="py-4 text-[13.5px] text-ink-2">
        Only the host can invite people to this room.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {candidates.length === 0 ? (
        <p className="py-4 text-[13.5px] text-ink-2">
          Everyone on your friends list is already here, or you haven’t added friends yet.
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {candidates.slice(0, 12).map((friend) => {
            const sent = invited.has(friend.id);
            return (
              <li key={friend.id} className="flex items-center gap-3 rounded-[14px] px-2 py-2">
                <StudiAvatar
                  profile={{
                    display_name: friend.display_name,
                    username: friend.username,
                    accent_color: friend.accent_color,
                    avatar_preference: friend.avatar_preference,
                    avatar_path: null,
                    google_avatar_url: null,
                  }}
                  src={friend.avatarSrc}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">
                    {friend.display_name || friend.username}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-3">@{friend.username}</p>
                </div>
                <button
                  type="button"
                  className={softPillClass}
                  disabled={isPending || sent}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await inviteFriendToRoom(roomId, friend.id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(`Invited @${friend.username}`);
                      setInvited((prev) => new Set(prev).add(friend.id));
                      if (result.inviteUrl) setLastLink(result.inviteUrl);
                    })
                  }
                >
                  {sent ? (
                    <>
                      <Check className="size-3.5" aria-hidden />
                      Invited
                    </>
                  ) : (
                    "Invite"
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {lastLink ? (
        <div className="flex flex-col gap-2 rounded-[18px] bg-sunken p-3.5">
          <label htmlFor="invite-link" className="text-[12.5px] text-ink-2">
            Invite link · expires in 48 hours
          </label>
          <div className="flex gap-2">
            <input
              id="invite-link"
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-full bg-raised px-3.5 text-[12.5px] text-ink outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
              value={lastLink}
            />
            <button
              type="button"
              className={softPillClass}
              onClick={async () => {
                await navigator.clipboard.writeText(lastLink);
                toast.success("Link copied");
              }}
            >
              <Copy className="size-3.5" aria-hidden />
              Copy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
