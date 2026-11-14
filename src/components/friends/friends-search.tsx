"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

import { searchDiscoverableUsers } from "@/actions/friends-search";
import { UserCard } from "@/components/friends/user-card";
import { softPillClass } from "@/components/studi/page-title";
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
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username"
          aria-label="Search people by username"
          autoComplete="off"
          className="h-11 w-full rounded-full bg-sunken pr-10 pl-10 text-base text-ink outline-none placeholder:text-ink-3 focus-visible:bg-raised focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-10 md:text-sm"
        />
        {isPending ? (
          <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ink-3 motion-reduce:animate-none" aria-hidden />
        ) : null}
      </div>
      <div aria-live="polite" className="contents">
        {!trimmed ? (
          <p className="px-1 text-[12.5px] text-ink-3">
            Only people who chose to be discoverable show up.
          </p>
        ) : null}
        {!isPending && trimmed && visibleResults.length === 0 ? (
          <p className="px-1 py-2 text-[13.5px] text-ink-2">
            No discoverable people match “{trimmed}”.
          </p>
        ) : null}
      </div>
      {visibleResults.length > 0 ? (
        <ul className="-mx-2.5 flex flex-col">
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
      ) : null}
      {canLoadMore ? (
        <button type="button" className={softPillClass} disabled={isPending} onClick={loadMore}>
          Load more
        </button>
      ) : null}
    </div>
  );
}
