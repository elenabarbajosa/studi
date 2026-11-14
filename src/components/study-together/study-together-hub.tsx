"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Check, Coffee, Lock, Plus, Timer, Users, X } from "lucide-react";
import { toast } from "sonner";

import {
  joinFriendsRoom,
  respondToInvite,
} from "@/actions/study-together";
import { Tile } from "@/components/dashboard/tile";
import { CreateRoomDialog } from "@/components/study-together/create-room-form";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { PageTitle, primaryPillClass } from "@/components/studi/page-title";
import type { getStudyTogetherHub } from "@/lib/data/study-together";
import { cn } from "@/lib/utils";

type HubData = Awaited<ReturnType<typeof getStudyTogetherHub>>;
type RoomCard = HubData["myRooms"][number];

const darkPill =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-canvas outline-none transition-opacity hover:opacity-90 focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50";

export function StudyTogetherHub({ data }: { data: HubData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  function run(action: () => Promise<{ error?: string; success?: string; roomId?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    });
  }

  const recent = data.recentRooms.filter(
    (card) => !data.myRooms.some((mine) => mine.room.id === card.room.id),
  );
  const nothingLive = data.myRooms.length === 0 && data.friendRooms.length === 0;

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <PageTitle
        title="Study Together"
        subtitle="One shared Pomodoro. Your subject and goal stay private."
        actions={
          <button type="button" className={primaryPillClass} onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Room
          </button>
        }
      />

      {data.invitations.length > 0 ? (
        <section aria-labelledby="invites-h" className="flex flex-col gap-3">
          <h2 id="invites-h" className="sr-only">
            Invitations
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.invitations.map((inv) => (
              <li key={inv.id}>
                <Tile variant="hero" className="flex items-center gap-3 p-4 md:p-5">
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-[14px] font-bold text-accent-text uppercase"
                  >
                    {inv.inviterUsername.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-ink">
                      @{inv.inviterUsername} invited you
                    </p>
                    <p className="truncate text-[13px] text-ink-2">
                      {inv.roomName} · expires{" "}
                      {new Date(inv.expires_at).toLocaleString(undefined, {
                        weekday: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Decline invitation to ${inv.roomName}`}
                    disabled={isPending}
                    onClick={() => run(() => respondToInvite(inv.id, false))}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-ink-2 outline-none transition-colors hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent-soft),0_0_0_4px_var(--accent)] disabled:opacity-50"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Accept invitation to ${inv.roomName}`}
                    disabled={isPending}
                    onClick={() => run(() => respondToInvite(inv.id, true))}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-colors hover:bg-accent-ink-hover focus-visible:shadow-[0_0_0_2px_var(--accent-soft),0_0_0_4px_var(--accent-ink)] disabled:opacity-50 dark:bg-accent dark:text-ink-on-accent"
                  >
                    <Check className="size-4" aria-hidden />
                  </button>
                </Tile>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nothingLive ? (
        <Tile className="px-5">
          <EmptyPanel
            icon={Coffee}
            title="No rooms open right now"
            body="Start a room and invite friends to share one Pomodoro. Friends-only rooms from your friends show up here too."
            action={
              <button type="button" className={primaryPillClass} onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" aria-hidden />
                New room
              </button>
            }
          />
        </Tile>
      ) : null}

      {data.myRooms.length > 0 ? (
        <RoomSection title="Your rooms" count={data.myRooms.length}>
          {data.myRooms.map((card) => (
            <RoomTile
              key={card.room.id}
              card={card}
              action={
                <Link href={`/study-together/${card.room.id}`} className={darkPill}>
                  Open
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
          ))}
        </RoomSection>
      ) : null}

      {data.friendRooms.length > 0 ? (
        <RoomSection title="Friends’ rooms" count={data.friendRooms.length}>
          {data.friendRooms.map((card) => (
            <RoomTile
              key={card.room.id}
              card={card}
              tone="friend"
              action={
                <button
                  type="button"
                  className={darkPill}
                  disabled={isPending || card.memberCount >= card.room.max_participants}
                  onClick={() =>
                    run(async () => {
                      const result = await joinFriendsRoom(card.room.id);
                      if (result.roomId) {
                        router.push(`/study-together/${result.roomId}`);
                      }
                      return result;
                    })
                  }
                >
                  {card.memberCount >= card.room.max_participants ? "Full" : "Join"}
                </button>
              }
            />
          ))}
        </RoomSection>
      ) : null}

      {recent.length > 0 ? (
        <section aria-labelledby="recent-h" className="flex flex-col gap-3">
          <h2 id="recent-h" className="type-tile text-ink">
            Recent
          </h2>
          <Tile className="p-1.5">
            <ul className="flex flex-col">
              {recent.map((card) => (
                <li
                  key={`recent-${card.room.id}`}
                  className="flex items-center gap-3 rounded-[16px] px-3.5 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-3">
                    {card.room.visibility === "private" ? (
                      <Lock className="size-3.5" aria-hidden />
                    ) : (
                      <Users className="size-3.5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{card.room.name}</p>
                    <p className="truncate text-[12.5px] text-ink-3">
                      {card.isHost ? "You hosted" : card.hostUsername ? `Host @${card.hostUsername}` : "Room"} ·{" "}
                      {new Date(card.room.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  {card.room.status === "active" ? (
                    <Link
                      href={`/study-together/${card.room.id}`}
                      className="rounded-full px-2 text-[13px] font-semibold text-accent-text outline-none hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent)]"
                    >
                      Open
                    </Link>
                  ) : (
                    <span className="text-[12.5px] text-ink-3">Ended</span>
                  )}
                </li>
              ))}
            </ul>
          </Tile>
        </section>
      ) : null}

      <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function RoomSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="flex items-center gap-2 type-tile text-ink">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
          <span className="relative size-2 rounded-full bg-success" />
        </span>
        {title}
        <span className="text-[13px] font-medium text-ink-3 tabular-nums">{count}</span>
      </h2>
      <ul className="grid gap-3 min-[640px]:grid-cols-2 min-[1280px]:grid-cols-3">{children}</ul>
    </section>
  );
}

function RoomTile({
  card,
  action,
  tone = "mine",
}: {
  card: RoomCard;
  action: React.ReactNode;
  tone?: "mine" | "friend";
}) {
  const { room } = card;
  const full = card.memberCount >= room.max_participants;
  return (
    <li>
      <Tile
        variant={tone === "mine" ? "hero" : "live"}
        className="flex h-full flex-col gap-4 p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{room.name}</p>
            <p className="mt-0.5 truncate text-[13px] text-ink-2">
              {card.isHost ? "You’re hosting" : card.hostUsername ? `Host @${card.hostUsername}` : "Study room"}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-raised/70 px-2.5 py-1 text-[12px] font-semibold text-ink-2 dark:bg-sunken">
            {room.visibility === "private" ? (
              <Lock className="size-3" aria-hidden />
            ) : (
              <Users className="size-3" aria-hidden />
            )}
            {room.visibility === "private" ? "Private" : "Friends"}
          </span>
        </div>
        {room.description ? (
          <p className="line-clamp-2 text-[13.5px] text-ink-2">{room.description}</p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3">
          <dl className="flex flex-col gap-1 text-[13px] text-ink-2">
            <div className="flex items-center gap-1.5">
              <dt>
                <Timer className="size-3.5" aria-hidden />
                <span className="sr-only">Rhythm</span>
              </dt>
              <dd className="tabular-nums">
                {room.focus_minutes}/{room.short_break_minutes} min · long {room.long_break_minutes}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>
                <Users className="size-3.5" aria-hidden />
                <span className="sr-only">People</span>
              </dt>
              <dd className={cn("tabular-nums", full && "font-semibold text-ink")}>
                {card.memberCount} of {room.max_participants}
              </dd>
            </div>
          </dl>
          {action}
        </div>
      </Tile>
    </li>
  );
}
