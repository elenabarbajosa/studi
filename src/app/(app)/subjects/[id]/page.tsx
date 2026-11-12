import { Suspense } from "react";
import { notFound } from "next/navigation";

import { SubjectDetail } from "@/components/subjects/subject-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listAssessmentsForSubject } from "@/lib/data/calendar";
import {
  getSubject,
  listMaterialsForSubject,
  listTopicsForSubject,
} from "@/lib/data/subjects";

export const instant = false;

type SubjectPageProps = {
  params: Promise<{ id: string }>;
};

async function SubjectPageContent({ params }: SubjectPageProps) {
  await requireProfile();
  const { id } = await params;
  const subject = await getSubject(id);
  if (!subject) {
    notFound();
  }

  const [topics, materials, assessments] = await Promise.all([
    listTopicsForSubject(subject.id),
    listMaterialsForSubject(subject.id),
    listAssessmentsForSubject(subject.id),
  ]);

  return (
    <SubjectDetail
      subject={subject}
      topics={topics}
      materials={materials}
      assessments={assessments}
    />
  );
}

export default function SubjectPage(props: SubjectPageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <SubjectPageContent {...props} />
    </Suspense>
  );
}
