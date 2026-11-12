"use client";

import { useState } from "react";

import { FriendsPresenceListener } from "@/components/friends/friends-presence-listener";
import { FriendsSearch } from "@/components/friends/friends-search";
import { UserCard } from "@/components/friends/user-card";
import { Button } from "@/components/ui/button";
import type {
  FriendListItem,
  RequestListItem,
} from "@/lib/data/friends";

type Tab = "friends" | "discover" | "incoming" | "sent" | "studying";

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
  const [tab, setTab] = useState<Tab>("friends");

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "friends", label: "My friends", count: friendCount },
    { id: "discover", label: "Discover" },
    { id: "incoming", label: "Incoming", count: pendingIncoming },
    { id: "sent", label: "Sent", count: pendingOutgoing },
    { id: "studying", label: "Studying now", count: studying.length },
  ];

  return (
    <div className="space-y-6">
      <FriendsPresenceListener enabled={friendCount > 0} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Friends" value={String(friendCount)} />
        <Stat label="Incoming requests" value={String(pendingIncoming)} />
        <Stat label="Studying now" value={String(studying.length)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={tab === item.id ? "default" : "outline"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.count != null ? ` (${item.count})` : ""}
          </Button>
        ))}
      </div>

      {tab === "discover" ? <FriendsSearch /> : null}

      {tab === "friends" ? (
        friends.length === 0 ? (
          <Empty
            title="No friends yet"
            description="Search for classmates by username to send a request."
          />
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
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
          <Empty
            title="No incoming requests"
            description="When someone adds you, their request appears here."
          />
        ) : (
          <ul className="space-y-2">
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
          <Empty
            title="No sent requests"
            description="Outgoing friend requests you can still cancel will show here."
          />
        ) : (
          <ul className="space-y-2">
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

      {tab === "studying" ? (
        studying.length === 0 ? (
          <Empty
            title="Nobody studying right now"
            description="Friends who share their study status appear here while focusing."
          />
        ) : (
          <ul className="space-y-2">
            {studying.map((f) => (
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
                />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="studi-panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tracking-tight">{value}</p>
    </div>
  );
}

function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="studi-panel px-5 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
