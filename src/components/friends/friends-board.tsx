"use client";

import Link from "next/link";
import { useState } from "react";
import { Inbox, Send, ShieldCheck, Users } from "lucide-react";

import { Tile, TileHeader } from "@/components/dashboard/tile";
import { FriendsPresenceListener } from "@/components/friends/friends-presence-listener";
import { FriendsSearch } from "@/components/friends/friends-search";
import { UserCard } from "@/components/friends/user-card";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { PageTitle } from "@/components/studi/page-title";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { Segmented, type SegmentedOption } from "@/components/studi/segmented";
import { presenceLabel } from "@/lib/social";
import type { FriendListItem, RequestListItem } from "@/lib/data/friends";

type Tab = "friends" | "incoming" | "sent";

type FriendsBoardProps = {
  friends: FriendListItem[];
  incoming: RequestListItem[];
  outgoing: RequestListItem[];
  studying: FriendListItem[];
  friendCount: number;
  pendingIncoming: number;
  pendingOutgoing: number;
};

export function FriendsBoard({
  friends,
  incoming,
  outgoing,
  studying,
  friendCount,
  pendingIncoming,
  pendingOutgoing,
}: FriendsBoardProps) {
  const [tab, setTab] = useState<Tab>(pendingIncoming > 0 ? "incoming" : "friends");

  const tabs: SegmentedOption<Tab>[] = [
    { value: "friends", label: "Friends", count: friendCount || undefined },
    { value: "incoming", label: "Requests", count: pendingIncoming || undefined },
    { value: "sent", label: "Sent", count: pendingOutgoing || undefined },
  ];

  const sortedFriends = [...friends].sort(
    (a, b) => presenceRank(a.presenceStatus) - presenceRank(b.presenceStatus),
  );

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <FriendsPresenceListener enabled={friendCount > 0} />
      <PageTitle
        title="Friends"
        subtitle={
          studying.length > 0
            ? `${studying.length} studying now · ${friendCount} ${friendCount === 1 ? "friend" : "friends"}`
            : "Classmates, requests, and who’s studying — only what they choose to share."
        }
      />

      <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_360px] min-[1100px]:gap-5">
        <Tile className="flex flex-col gap-4 p-4 md:p-6">
          <Segmented
            value={tab}
            onChange={setTab}
            options={tabs}
            label="Friends lists"
            stretch
            className="min-[640px]:w-fit"
          />

          {tab === "friends" ? (
            sortedFriends.length === 0 ? (
              <EmptyPanel
                icon={Users}
                title="No friends yet"
                body="Search for classmates by username to send a request."
                compact
              />
            ) : (
              <ul className="-mx-2.5 grid min-[1280px]:grid-cols-2 min-[1280px]:gap-x-2">
                {sortedFriends.map((f) => (
                  <li key={f.id}>
                    <UserCard
                      id={f.id}
                      username={f.username}
                      displayName={f.display_name}
                      accentColor={f.accent_color}
                      avatarPreference={f.avatar_preference}
                      avatarSrc={f.avatarSrc}
                      friendshipStatus="friends"
                      presenceStatus={f.presenceStatus}
                      weeklyFocusSeconds={f.weeklyFocusSeconds}
                      showBlock
                    />
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === "incoming" ? (
            incoming.length === 0 ? (
              <EmptyPanel
                icon={Inbox}
                title="No requests"
                body="When someone adds you, their request appears here."
                compact
              />
            ) : (
              <ul className="-mx-2.5 flex flex-col">
                {incoming.map((item) => (
                  <li key={item.request.id}>
                    <UserCard
                      id={item.request.requester_id}
                      username={item.username}
                      displayName={item.display_name}
                      accentColor={item.accent_color}
                      avatarPreference={item.avatar_preference}
                      avatarSrc={item.avatarSrc}
                      friendshipStatus="incoming"
                      requestId={item.request.id}
                      showBlock
                    />
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === "sent" ? (
            outgoing.length === 0 ? (
              <EmptyPanel
                icon={Send}
                title="No sent requests"
                body="Requests you send stay here until they’re answered, and you can cancel them."
                compact
              />
            ) : (
              <ul className="-mx-2.5 flex flex-col">
                {outgoing.map((item) => (
                  <li key={item.request.id}>
                    <UserCard
                      id={item.request.recipient_id}
                      username={item.username}
                      displayName={item.display_name}
                      accentColor={item.accent_color}
                      avatarPreference={item.avatar_preference}
                      avatarSrc={item.avatarSrc}
                      friendshipStatus="outgoing"
                      requestId={item.request.id}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </Tile>

        <div className="order-first flex flex-col gap-4 min-[1100px]:order-none min-[1100px]:gap-5">
          <Tile className="flex flex-col gap-3 p-4 md:p-5">
            <TileHeader title="Find people" />
            <FriendsSearch />
          </Tile>

          <StudyingNow studying={studying} />

          <p className="hidden items-start gap-2 px-1 text-[12.5px] leading-relaxed text-ink-3 min-[1100px]:flex">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Friends only see what you share. Change discoverability, avatar and study status in{" "}
              <Link href="/settings" className="font-medium text-accent-text hover:text-ink">
                Settings
              </Link>
              .
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function presenceRank(status: FriendListItem["presenceStatus"]) {
  return status === "focusing" ? 0 : status === "on_break" ? 1 : status === "online" ? 2 : 3;
}

function StudyingNow({ studying }: { studying: FriendListItem[] }) {
  if (studying.length === 0) {
    return (
      <Tile variant="live" className="flex items-center gap-3 p-4 md:p-5">
        <span className="size-2.5 shrink-0 rounded-full bg-success/40" aria-hidden />
        <p className="text-[13.5px] text-ink-2">
          Nobody is studying right now. Friends who share their status appear here while they focus.
        </p>
      </Tile>
    );
  }

  return (
    <Tile variant="live" className="flex flex-col gap-3 p-4 md:p-5">
      <TileHeader
        title={
          <span className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-50 motion-reduce:hidden" />
              <span className="relative size-2.5 rounded-full bg-success" />
            </span>
            Studying now
          </span>
        }
        action={<span className="text-[13px] font-medium text-success">{studying.length}</span>}
      />
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 min-[1100px]:flex-col min-[1100px]:gap-1 min-[1100px]:overflow-visible">
        {studying.map((f) => (
          <li key={f.id} className="shrink-0">
            <Link
              href={`/u/${f.username}`}
              className="flex w-[76px] flex-col items-center gap-1.5 rounded-2xl p-1 text-center outline-none transition-colors hover:bg-raised/60 focus-visible:shadow-[0_0_0_2px_var(--accent)] min-[1100px]:w-full min-[1100px]:flex-row min-[1100px]:gap-3 min-[1100px]:p-2 min-[1100px]:text-left"
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
                size={40}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[12.5px] font-semibold text-ink min-[1100px]:text-[14px]">
                  {f.display_name || f.username}
                </span>
                <span className="truncate text-[11.5px] text-success min-[1100px]:text-[12.5px]">
                  {f.presenceLabel || presenceLabel(f.presenceStatus)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
