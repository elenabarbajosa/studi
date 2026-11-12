import { Suspense } from "react";

import { StudyTogetherHub } from "@/components/study-together/study-together-hub";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { getStudyTogetherHub } from "@/lib/data/study-together";

export const metadata = { title: "Study Together" };

async function HubContent() {
  await requireProfile();
  const data = await getStudyTogetherHub();
  return (
    <div>
      <PageHeader
        title="Study Together"
        description="Private rooms with synchronized Pomodoro, live presence, and optional chat during breaks."
      />
      <StudyTogetherHub data={data} />
    </div>
  );
}

function HubFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export default function StudyTogetherPage() {
  return (
    <Suspense fallback={<HubFallback />}>
      <HubContent />
    </Suspense>
  );
}
