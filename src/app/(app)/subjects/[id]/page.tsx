import { Suspense } from "react";
import { notFound } from "next/navigation";

import { SubjectDetail, type SubjectTab } from "@/components/subjects/subject-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import {
  listAssessmentsForSubject,
  listSubtasksForTasks,
  listTasks,
} from "@/lib/data/calendar";
import {
  getSubject,
  listMaterialsForSubject,
  listSubjects,
  listTopicsForSubject,
} from "@/lib/data/subjects";

export const instant = false;

type SubjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseTab(value: string | string[] | undefined): SubjectTab {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "assessments") return "exams";
  if (v === "materials" || v === "exams" || v === "tasks" || v === "progress") return v;
  return "topics";
}

async function SubjectPageContent({ params, searchParams }: SubjectPageProps) {
  await requireProfile();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const subject = await getSubject(id);
  if (!subject) {
    notFound();
  }

  const [topics, materials, assessments, allTasks, subjects] = await Promise.all([
    listTopicsForSubject(subject.id),
    listMaterialsForSubject(subject.id),
    listAssessmentsForSubject(subject.id),
    listTasks(),
    listSubjects(),
  ]);
  const tasks = allTasks.filter((t) => t.subject_id === subject.id);
  const subtasks = await listSubtasksForTasks(tasks.map((t) => t.id));

  return (
    <SubjectDetail
      subject={subject}
      subjects={subjects}
      topics={topics}
      materials={materials}
      assessments={assessments}
      tasks={tasks}
      subtasks={subtasks}
      initialTab={parseTab(query.tab)}
    />
  );
}

function SubjectFallback() {
  return (
    <div className="mx-auto w-full max-w-[1120px]" aria-busy="true" aria-label="Loading subject">
      <Skeleton className="mb-3 h-9 w-28 rounded-full" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[188px] w-full rounded-[24px]" />
          <Skeleton className="h-[420px] w-full rounded-[24px]" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[200px] w-full rounded-[24px]" />
          <Skeleton className="h-[92px] w-full rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Pick<SubjectPageProps, "params">) {
  const { id } = await params;
  const subject = await getSubject(id);
  return { title: subject?.name ?? "Subject" };
}

export default function SubjectPage(props: SubjectPageProps) {
  return (
    <Suspense fallback={<SubjectFallback />}>
      <SubjectPageContent {...props} />
    </Suspense>
  );
}
