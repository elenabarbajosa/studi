import { Suspense } from "react";

import type { SubjectTileData } from "@/components/subjects/subject-card";
import { SubjectsOverview } from "@/components/subjects/subjects-overview";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listAssessments } from "@/lib/data/calendar";
import { listSubjects, listTopicsForSubject } from "@/lib/data/subjects";
import { daysUntil } from "@/lib/dashboard";
import { topicProgressSummary } from "@/lib/subjects";

export const metadata = { title: "Subjects" };

async function SubjectsContent() {
  await requireProfile();
  const [subjects, assessments] = await Promise.all([listSubjects(), listAssessments()]);
  const now = new Date();

  const tiles: SubjectTileData[] = await Promise.all(
    subjects.map(async (subject) => {
      const topics = await listTopicsForSubject(subject.id);
      const summary = topicProgressSummary(topics);
      const next = assessments
        .filter(
          (a) => a.subject_id === subject.id && !a.completed && daysUntil(a.starts_at, now) >= 0,
        )
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
      return {
        subject,
        topicCount: summary.total,
        masteredCount: summary.mastered,
        nextAssessment: next ? { title: next.title, days: daysUntil(next.starts_at, now) } : null,
      };
    }),
  );

  return <SubjectsOverview tiles={tiles} />;
}

function SubjectsFallback() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading subjects">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[190px] rounded-[24px]" />
        ))}
      </div>
    </div>
  );
}

export default function SubjectsPage() {
  return (
    <Suspense fallback={<SubjectsFallback />}>
      <SubjectsContent />
    </Suspense>
  );
}
