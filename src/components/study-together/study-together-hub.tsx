"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  joinFriendsRoom,
  respondToInvite,
} from "@/actions/study-together";
import { CreateRoomForm } from "@/components/study-together/create-room-form";
import { Button, buttonVariants } from "@/components/ui/button";
import type { getStudyTogetherHub } from "@/lib/data/study-together";
import { cn } from "@/lib/utils";

type HubData = Awaited<ReturnType<typeof getStudyTogetherHub>>;

export function StudyTogetherHub({ data }: { data: HubData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: string; roomId?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Your active rooms" value={String(data.myRooms.length)} />
        <Stat label="Invitations" value={String(data.pendingInviteCount)} />
        <Stat label="Friends' rooms" value={String(data.friendRooms.length)} />
      </div>

      {data.invitations.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl tracking-tight">Invitations</h2>
          <ul className="space-y-2">
            {data.invitations.map((inv) => (
              <li
                key={inv.id}
                className="studi-panel flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{inv.roomName}</p>
                  <p className="text-xs text-muted-foreground">
                    From @{inv.inviterUsername} · expires{" "}
                    {new Date(inv.expires_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => run(() => respondToInvite(inv.id, true))}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => run(() => respondToInvite(inv.id, false))}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-display text-2xl tracking-tight">Your rooms</h2>
            {data.myRooms.length === 0 ? (
              <Empty
                title="No active rooms"
                description="Create a room and invite friends to sync a Pomodoro together."
              />
            ) : (
              <ul className="space-y-2">
                {data.myRooms.map((card) => (
                  <RoomRow key={card.room.id} card={card} />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl tracking-tight">
              Friends studying
            </h2>
            {data.friendRooms.length === 0 ? (
              <Empty
                title="No friend rooms right now"
                description="When friends open a friends-only room, it appears here."
              />
            ) : (
              <ul className="space-y-2">
                {data.friendRooms.map((card) => (
                  <li
                    key={card.room.id}
                    className="studi-panel flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="font-medium">{card.room.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Host @{card.hostUsername} · {card.memberCount}/
                        {card.room.max_participants}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
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
                      Join
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.recentRooms.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-2xl tracking-tight">Recent</h2>
              <ul className="space-y-2">
                {data.recentRooms.map((card) => (
                  <RoomRow key={`recent-${card.room.id}`} card={card} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <CreateRoomForm />
      </div>
    </div>
  );
}

function RoomRow({
  card,
}: {
  card: HubData["myRooms"][number];
}) {
  return (
    <li className="studi-panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-medium">{card.room.name}</p>
        <p className="text-xs text-muted-foreground">
          {card.room.status} · {card.memberCount}/{card.room.max_participants}
          {card.isHost ? " · Host" : ""} · {card.room.visibility}
        </p>
      </div>
      {card.room.status === "active" ? (
        <Link
          href={`/study-together/${card.room.id}`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Open
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Ended</span>
      )}
    </li>
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
    <div className="studi-panel px-5 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
