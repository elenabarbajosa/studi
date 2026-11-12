"use client";

import { useEffect, useState, useTransition } from "react";

import { searchDiscoverableUsers } from "@/actions/friends-search";
import { UserCard } from "@/components/friends/user-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DiscoverableProfile } from "@/lib/social";

const PAGE_SIZE = 20;

export function FriendsSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoverableProfile[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const trimmed = query.trim();
  const visibleResults = trimmed.length < 1 ? [] : results;
  const canLoadMore = trimmed.length >= 1 && hasMore;

  useEffect(() => {
    if (trimmed.length < 1) return;

    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const rows = await searchDiscoverableUsers(trimmed, 0);
        setResults(rows);
        setHasMore(rows.length >= PAGE_SIZE);
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [trimmed]);

  function loadMore() {
    if (!trimmed) return;
    startTransition(async () => {
      const rows = await searchDiscoverableUsers(trimmed, results.length);
      setResults((prev) => [...prev, ...rows]);
      setHasMore(rows.length >= PAGE_SIZE);
    });
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username…"
        aria-label="Search users by username"
      />
      {isPending && visibleResults.length === 0 && trimmed ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : null}
      {!isPending && trimmed && visibleResults.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No discoverable users match “{trimmed}”.
        </p>
      ) : null}
      <ul className="space-y-2">
        {visibleResults.map((user) => (
          <li key={user.id}>
            <UserCard
              id={user.id}
              username={user.username}
              displayName={user.display_name}
              accentColor={user.accent_color}
              avatarPreference={user.avatar_preference}
              avatarSrc={user.avatarSrc}
              bio={user.bio}
              friendshipStatus={user.friendship_status}
              requestId={user.request_id ?? undefined}
              showBlock
            />
          </li>
        ))}
      </ul>
      {canLoadMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={loadMore}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
