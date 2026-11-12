import Link from "next/link";
import { Users } from "lucide-react";

import { StudiAvatar } from "@/components/shared/studi-avatar";
import { buttonVariants } from "@/components/ui/button";
import type { FriendListItem } from "@/lib/data/friends";
import { presenceLabel } from "@/lib/social";
import { cn } from "@/lib/utils";

type FriendsPanelProps = {
  friendCount: number;
  pendingIncoming: number;
  studying: FriendListItem[];
  preview: FriendListItem[];
};

export function FriendsPanel({
  friendCount,
  pendingIncoming,
  studying,
  preview,
}: FriendsPanelProps) {
  return (
    <section className="studi-panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">Friends</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {friendCount} friend{friendCount === 1 ? "" : "s"}
            {pendingIncoming > 0
              ? ` · ${pendingIncoming} request${pendingIncoming === 1 ? "" : "s"}`
              : ""}
            {studying.length > 0
              ? ` · ${studying.length} studying now`
              : ""}
          </p>
        </div>
        <Link
          href="/friends"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <Users className="size-4" aria-hidden />
          Open
        </Link>
      </div>

      {preview.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Find classmates by username to start studying together later.
        </p>
      ) : (
        <ul className="space-y-3">
          {preview.slice(0, 4).map((friend) => (
            <li key={friend.id}>
              <Link
                href={`/u/${friend.username}`}
                className="flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-muted/50"
              >
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
                  showOnline={friend.presenceStatus !== "offline"}
                  online={friend.presenceStatus !== "offline"}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {friend.display_name || friend.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {friend.presenceStatus !== "offline"
                      ? presenceLabel(friend.presenceStatus)
                      : `@${friend.username}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
