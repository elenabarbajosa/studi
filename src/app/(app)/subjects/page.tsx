import { Suspense } from "react";
import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SubjectCard } from "@/components/subjects/subject-card";
import { SubjectForm } from "@/components/subjects/subject-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listSubjects, listTopicsForSubject } from "@/lib/data/subjects";
import { topicProgressSummary } from "@/lib/subjects";

export const metadata = { title: "Subjects" };

async function SubjectsContent() {
  await requireProfile();
  const subjects = await listSubjects();

  const cards = await Promise.all(
    subjects.map(async (subject) => {
      const topics = await listTopicsForSubject(subject.id);
      const summary = topicProgressSummary(topics);
      return { subject, summary };
    }),
  );

  return (
    <div>
      <PageHeader
        title="Subjects"
        description="Organize courses with topics, materials, and honest progress."
      />

      {cards.length === 0 ? (
        <div className="mb-8">
          <EmptyState
            icon={BookOpen}
            title="No subjects yet"
            description="Create your first course to start building topics and materials. Nothing is simulated."
            hint="Private to your account"
          />
        </div>
      ) : (
        <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ subject, summary }) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              topicCount={summary.total}
              masteredCount={summary.mastered}
            />
          ))}
        </div>
      )}

      <section className="studi-panel p-6 sm:p-8">
        <h2 className="font-display text-2xl tracking-tight">
          {cards.length === 0 ? "Create your first subject" : "Add another subject"}
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Choose a color and optional difficulty so your workspace stays scannable.
        </p>
        <SubjectForm />
      </section>
    </div>
  );
}

export default function SubjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      }
    >
      <SubjectsContent />
    </Suspense>
  );
}
