import { Suspense } from "react";

import { CountdownsBoard, type CountdownRow } from "@/components/countdowns/countdowns-board";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listAssessments } from "@/lib/data/calendar";
import { getGamificationPreferences } from "@/lib/data/progress";
import { listSubjects } from "@/lib/data/subjects";
import { calendarDaysUntil } from "@/lib/countdown";

export const metadata = { title: "Countdowns" };

async function CountdownsContent() {
  await requireProfile();
  const [assessments, subjects, gamification] = await Promise.all([
    listAssessments(),
    listSubjects(),
    getGamificationPreferences(),
  ]);
  const timeZone = gamification.timezone || "UTC";
  const now = new Date();
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const toRow = (a: (typeof assessments)[number]): CountdownRow => {
    const subject = a.subject_id ? subjectById.get(a.subject_id) : undefined;
    return {
      assessment: a,
      subjectName: subject?.name ?? null,
      subjectColor: subject?.color ?? null,
      href: subject ? `/subjects/${subject.id}` : "/calendar",
    };
  };

  const upcoming = assessments
    .filter((a) => {
      if (a.completed) return false;
      return calendarDaysUntil(a.starts_at, timeZone, now) >= 0;
    })
    .sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    .map(toRow);

  const past = assessments
    .filter((a) => a.completed || calendarDaysUntil(a.starts_at, timeZone, now) < 0)
    .sort(
      (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    )
    .map(toRow);

  return (
    <CountdownsBoard
      upcoming={upcoming}
      past={past}
      subjects={subjects}
      timeZone={timeZone}
    />
  );
}

function CountdownsFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4" aria-busy>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-10 w-56 rounded-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-[22px]" />
        <Skeleton className="h-40 rounded-[22px]" />
        <Skeleton className="h-40 rounded-[22px]" />
        <Skeleton className="h-40 rounded-[22px]" />
      </div>
    </div>
  );
}

export default function CountdownsPage() {
  return (
    <Suspense fallback={<CountdownsFallback />}>
      <CountdownsContent />
    </Suspense>
  );
}
