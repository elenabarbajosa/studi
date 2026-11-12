import { Suspense } from "react";

import { FriendsBoard } from "@/components/friends/friends-board";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { getFriendsDashboard } from "@/lib/data/friends";

export const metadata = { title: "Friends" };

async function FriendsContent() {
  await requireProfile();
  const data = await getFriendsDashboard();

  return (
    <div>
      <PageHeader
        title="Friends"
        description="Find classmates, manage requests, and see who’s focusing — only with their permission."
      />
      <FriendsBoard {...data} />
    </div>
  );
}

function FriendsFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-40" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
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
