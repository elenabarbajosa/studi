import { Suspense } from "react";

import { ProgressBoard } from "@/components/progress/progress-board";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listFriends } from "@/lib/data/friends";
import {
  getFriendsLeaderboard,
  getProgressDashboard,
} from "@/lib/data/progress";

export const metadata = { title: "Progress" };

async function ProgressContent() {
  await requireProfile();
  const [data, leaderboard, friends] = await Promise.all([
    getProgressDashboard(),
    getFriendsLeaderboard(),
    listFriends(),
  ]);

  return (
    <div>
      <PageHeader
        title="Progress"
        description="Streaks, weekly goals, achievements, challenges, and an optional friends leaderboard — all from verified focus time."
      />
      <ProgressBoard
        data={data}
        leaderboard={leaderboard}
        friends={friends}
      />
    </div>
  );
}

function ProgressFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-3 sm:grid-cols-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<ProgressFallback />}>
      <ProgressContent />
    </Suspense>
  );
}
