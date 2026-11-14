import { Suspense } from "react";

import { ProgressBoard } from "@/components/progress/progress-board";
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
    <ProgressBoard data={data} leaderboard={leaderboard} friends={friends} />
  );
}

function ProgressFallback() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <Skeleton className="h-9 w-40 rounded-full" />
      <div className="grid gap-5 min-[1100px]:grid-cols-12">
        <Skeleton className="h-[250px] rounded-[26px] min-[1100px]:col-span-5" />
        <Skeleton className="h-[250px] rounded-[26px] min-[1100px]:col-span-3" />
        <Skeleton className="h-[250px] rounded-[26px] min-[1100px]:col-span-4" />
        <Skeleton className="h-[280px] rounded-[26px] min-[1100px]:col-span-8" />
        <Skeleton className="h-[280px] rounded-[26px] min-[1100px]:col-span-4" />
      </div>
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
