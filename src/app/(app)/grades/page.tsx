import { Suspense } from "react";

import { GradesBoard } from "@/components/grades/grades-board";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listAssessments } from "@/lib/data/calendar";
import { listGradeBundlesForUser } from "@/lib/data/grades";
import { listSubjects } from "@/lib/data/subjects";

export const metadata = { title: "Grades" };

async function GradesContent() {
  await requireProfile();
  const [subjects, bundles, assessments] = await Promise.all([
    listSubjects(),
    listGradeBundlesForUser(),
    listAssessments(),
  ]);

  return (
    <GradesBoard
      subjects={subjects}
      bundles={bundles}
      assessments={assessments}
    />
  );
}

export default function GradesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full rounded-[22px]" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-40 rounded-[22px]" />
            <Skeleton className="h-40 rounded-[22px]" />
            <Skeleton className="h-40 rounded-[22px]" />
          </div>
        </div>
      }
    >
      <GradesContent />
    </Suspense>
  );
}
