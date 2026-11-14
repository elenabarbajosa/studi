import { Suspense } from "react";

import { StudyTogetherHub } from "@/components/study-together/study-together-hub";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { getStudyTogetherHub } from "@/lib/data/study-together";

export const metadata = { title: "Study Together" };

async function HubContent() {
  await requireProfile();
  const data = await getStudyTogetherHub();
  return <StudyTogetherHub data={data} />;
}

function HubFallback() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-56 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="grid gap-3 min-[640px]:grid-cols-2 min-[1280px]:grid-cols-3">
        <Skeleton className="h-44 rounded-[26px]" />
        <Skeleton className="h-44 rounded-[26px]" />
        <Skeleton className="h-44 rounded-[26px]" />
      </div>
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
