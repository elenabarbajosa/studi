import { Suspense } from "react";

import { FocusStatsPanel } from "@/components/statistics/focus-stats-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { getFocusStats } from "@/lib/data/focus";
import { listSubjects } from "@/lib/data/subjects";

export const metadata = { title: "Statistics" };

async function StatisticsContent() {
  await requireProfile();
  const [stats, subjects] = await Promise.all([
    getFocusStats(),
    listSubjects(),
  ]);

  return (
    <FocusStatsPanel stats={stats} subjects={subjects} />
  );
}

function StatisticsFallback() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <Skeleton className="h-9 w-48 rounded-full" />
      <Skeleton className="h-[104px] rounded-[22px]" />
      <div className="grid gap-5 min-[1100px]:grid-cols-12">
        <Skeleton className="h-[300px] rounded-[26px] min-[1100px]:col-span-8" />
        <Skeleton className="h-[300px] rounded-[26px] min-[1100px]:col-span-4" />
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  return (
    <Suspense fallback={<StatisticsFallback />}>
      <StatisticsContent />
    </Suspense>
  );
}
