"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { inviteFriendToRoom } from "@/actions/study-together";
import { Button } from "@/components/ui/button";
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
  const candidates = friends.filter((f) => !memberIds.includes(f.id));

  if (!canInvite) return null;

  return (
    <div className="studi-panel space-y-3 p-4">
      <h3 className="font-medium">Invite friends</h3>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No friends left to invite, or they are already in the room.
        </p>
      ) : (
        <ul className="space-y-2">
          {candidates.slice(0, 12).map((friend) => (
            <li
              key={friend.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>
                {friend.display_name || friend.username}{" "}
                <span className="text-muted-foreground">@{friend.username}</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await inviteFriendToRoom(roomId, friend.id);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(`Invited @${friend.username}`);
                    if (result.inviteUrl) setLastLink(result.inviteUrl);
                  })
                }
              >
                Invite
              </Button>
            </li>
          ))}
        </ul>
      )}
      {lastLink ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Copyable invite link (expires in 48h):
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"
              value={lastLink}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(lastLink);
                toast.success("Link copied");
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
