import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { StudyRoomBoard } from "@/components/study-together/study-room-board";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listTasks } from "@/lib/data/calendar";
import { listFriends } from "@/lib/data/friends";
import { getStudyRoomBundle } from "@/lib/data/study-together";
import {
  getStudyPreferences,
  listAllTopics,
  listSubjects,
} from "@/lib/data/subjects";
import type { SoundscapeId } from "@/lib/calendar";
import type { FocusPreferences } from "@/lib/focus/types";
import { joinFriendsRoom } from "@/actions/study-together";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ roomId: string }>;
};

function toFocusPrefs(
  prefs: Awaited<ReturnType<typeof getStudyPreferences>>,
): FocusPreferences {
  return {
    pomodoro_focus_minutes: prefs?.pomodoro_focus_minutes ?? 25,
    pomodoro_short_break_minutes: prefs?.pomodoro_short_break_minutes ?? 5,
    pomodoro_long_break_minutes: prefs?.pomodoro_long_break_minutes ?? 15,
    pomodoro_intervals_before_long:
      prefs?.pomodoro_intervals_before_long ?? 4,
    auto_start_breaks: prefs?.auto_start_breaks ?? false,
    focus_sound_enabled: prefs?.focus_sound_enabled ?? true,
    soundscape_primary: (prefs?.soundscape_primary ??
      "silence") as SoundscapeId,
    soundscape_secondary: (prefs?.soundscape_secondary ??
      "silence") as SoundscapeId,
    soundscape_volume: prefs?.soundscape_volume ?? 0.45,
    soundscape_secondary_volume: prefs?.soundscape_secondary_volume ?? 0,
  };
}

async function RoomContent({ params }: PageProps) {
  const { profile } = await requireProfile();
  const { roomId } = await params;
  let bundle = await getStudyRoomBundle(roomId);

  if (!bundle) notFound();

  // Friends-only: allow join from room page if authorized and not yet a member
  if (
    !bundle.isMember &&
    bundle.room.status === "active" &&
    bundle.room.visibility === "friends"
  ) {
    const joined = await joinFriendsRoom(roomId);
    if (!joined.error) {
      bundle = await getStudyRoomBundle(roomId);
    }
  }

  if (!bundle || !bundle.isMember || !bundle.timer) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="font-display text-3xl tracking-tight">
          {bundle?.room.name ?? "Room"}
        </h1>
        <p className="text-sm text-muted-foreground">
          You need a valid invitation to enter this private room, or friendship
          for a friends-only room.
        </p>
        <Link
          href="/study-together"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to hub
        </Link>
      </div>
    );
  }

  const [friends, subjects, topics, tasks, preferences] = await Promise.all([
    listFriends(),
    listSubjects(),
    listAllTopics(),
    listTasks(),
    getStudyPreferences(),
  ]);

  const canInvite =
    bundle.isHost || bundle.room.members_can_invite;

  return (
    <StudyRoomBoard
      room={bundle.room}
      userId={profile.id}
      isHost={bundle.isHost}
      canInvite={canInvite}
      timer={bundle.timer}
      members={bundle.members}
      messages={bundle.messages}
      serverNow={bundle.serverNow}
      friends={friends}
      subjects={subjects}
      topics={topics}
      tasks={tasks}
      preferences={toFocusPrefs(preferences)}
    />
  );
}

function RoomFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { roomId } = await params;
  return { title: `Room ${roomId.slice(0, 8)}` };
}

export default function StudyRoomPage(props: PageProps) {
  return (
    <Suspense fallback={<RoomFallback />}>
      <RoomContent {...props} />
    </Suspense>
  );
}
