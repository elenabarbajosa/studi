import { Suspense } from "react";

import { FriendsBoard } from "@/components/friends/friends-board";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { getFriendsDashboard } from "@/lib/data/friends";

export const metadata = { title: "Friends" };

async function FriendsContent() {
  await requireProfile();
  const data = await getFriendsDashboard();

  return <FriendsBoard {...data} />;
}

function FriendsFallback() {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36 rounded-xl" />
        <Skeleton className="h-4 w-72 rounded-lg" />
      </div>
      <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_360px] min-[1100px]:gap-5">
        <Skeleton className="h-96 rounded-[22px] md:rounded-[26px]" />
        <div className="order-first flex flex-col gap-4 min-[1100px]:order-none min-[1100px]:gap-5">
          <Skeleton className="h-32 rounded-[22px] md:rounded-[26px]" />
          <Skeleton className="h-28 rounded-[22px] md:rounded-[26px]" />
        </div>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={<FriendsFallback />}>
      <FriendsContent />
    </Suspense>
  );
}
