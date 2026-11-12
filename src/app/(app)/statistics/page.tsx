import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
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
    <div>
      <PageHeader
        title="Statistics"
        description="Honest productivity from your saved focus sessions — breaks are excluded."
      />
      <FocusStatsPanel stats={stats} subjects={subjects} />
    </div>
  );
}

function StatisticsFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
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
