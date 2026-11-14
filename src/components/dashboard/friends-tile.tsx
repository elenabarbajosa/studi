import Link from "next/link";

import { Tile } from "@/components/dashboard/tile";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import type { FriendListItem } from "@/lib/data/friends";
import { presenceLabel } from "@/lib/social";
import { cn } from "@/lib/utils";

export type FriendsTileData = {
  friendCount: number;
  pendingIncoming: number;
  studying: FriendListItem[];
  friends: FriendListItem[];
  /** `ownerLabel` reads like "Your room" or "@marco’s room". */
  room: { id: string; name: string; ownerLabel: string } | null;
};

function friendName(f: FriendListItem) {
  return f.display_name?.split(" ")[0] || f.username;
}

function AvatarStack({
  people,
  size,
  ringClass,
}: {
  people: FriendListItem[];
  size: number;
  ringClass: string;
}) {
  return (
    <div className="flex" aria-hidden>
      {people.map((f) => (
        <span
          key={f.id}
          className={cn("-mr-2.5 rounded-full border-[3px] last:mr-0", ringClass)}
        >
          <StudiAvatar
            profile={{
              display_name: f.display_name,
              username: f.username,
              accent_color: f.accent_color,
              avatar_preference: f.avatar_preference,
              avatar_path: null,
              google_avatar_url: null,
            }}
            src={f.avatarSrc}
            size={size}
          />
        </span>
      ))}
    </div>
  );
}

function summary(data: FriendsTileData) {
  const live = data.studying.length;
  if (live > 0) return `${live} ${live === 1 ? "friend" : "friends"} live`;
  if (data.friendCount > 0)
    return `${data.friendCount} ${data.friendCount === 1 ? "friend" : "friends"}`;
  return "Study with friends";
}

function sentence(data: FriendsTileData): React.ReactNode {
  if (data.room) {
    return (
      <>
        {data.room.ownerLabel}{" "}
        <strong className="font-semibold">{data.room.name}</strong> is open now.
      </>
    );
  }
  const [first, second] = data.studying;
  if (first && second) {
    return `${friendName(first)} and ${data.studying.length - 1} more are studying now.`;
  }
  if (first) {
    return `${friendName(first)} is ${presenceLabel(first.presenceStatus).toLowerCase()} right now.`;
  }
  if (data.friendCount > 0) return "No one is studying right now. Start a room and invite them.";
  return "Find classmates by username and sync a Pomodoro together.";
}

function action(data: FriendsTileData) {
  if (data.room) return { href: `/study-together/${data.room.id}`, label: "Join room" };
  if (data.friendCount === 0) return { href: "/friends", label: "Find friends" };
  return { href: "/study-together", label: "Study Together" };
}

export function FriendsTile({ data }: { data: FriendsTileData }) {
  const live = data.studying.length > 0;
  const people = (live ? data.studying : data.friends).slice(0, 4);
  const cta = action(data);

  return (
    <Tile
      variant="live"
      aria-labelledby="friends-title"
      className="flex flex-[3_1_220px] flex-col gap-3 px-[22px] py-5 text-ink"
    >
      <div className="flex items-center gap-2">
        {live ? (
          <span className="size-2 shrink-0 rounded-full bg-live" aria-hidden />
        ) : null}
        <h2 id="friends-title" className="type-tile">
          <Link
            href="/friends"
            className="rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {summary(data)}
          </Link>
        </h2>
      </div>
      {people.length > 0 ? (
        <AvatarStack people={people} size={40} ringClass="border-success-soft" />
      ) : null}
      <p className="text-[13.5px] leading-[1.45] text-[#2F4A3C] dark:text-ink-2">
        {sentence(data)}
      </p>
      {data.pendingIncoming > 0 ? (
        <Link
          href="/friends"
          className="w-fit rounded-md text-[13px] font-semibold text-success outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {data.pendingIncoming} friend{" "}
          {data.pendingIncoming === 1 ? "request" : "requests"}
        </Link>
      ) : null}
      <Link
        href={cta.href}
        className="mt-auto flex h-10 w-full max-w-80 items-center justify-center rounded-full bg-ink text-sm font-semibold text-canvas outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-success-soft"
      >
        {cta.label}
      </Link>
    </Tile>
  );
}

export function MobileFriendsStrip({ data }: { data: FriendsTileData }) {
  const live = data.studying.length > 0;
  const people = (live ? data.studying : data.friends).slice(0, 3);
  const cta = action(data);
  const label = live
    ? `${data.studying.length} ${data.studying.length === 1 ? "friend" : "friends"} studying`
    : data.friendCount > 0
      ? `${data.friendCount} ${data.friendCount === 1 ? "friend" : "friends"}${data.pendingIncoming ? ` · ${data.pendingIncoming} new` : ""}`
      : "Study with friends";

  return (
    <section
      aria-label="Friends"
      className="flex items-center gap-3 rounded-[22px] bg-success-soft px-4 py-3.5 text-ink"
    >
      {people.length > 0 ? (
        <AvatarStack people={people} size={28} ringClass="border-success-soft border-2" />
      ) : null}
      <Link
        href="/friends"
        className="ml-1 min-w-0 flex-1 truncate text-[13.5px] font-semibold outline-none focus-visible:underline"
      >
        {label}
      </Link>
      <Link
        href={cta.href}
        className="flex min-h-11 shrink-0 items-center text-[13.5px] font-semibold text-success outline-none focus-visible:underline"
      >
        {data.room ? "Join" : data.friendCount === 0 ? "Find" : "Open"}
        <span className="sr-only"> — {cta.label}</span>
      </Link>
    </section>
  );
}
