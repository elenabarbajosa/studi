import Link from "next/link";

import { SUBJECT_COLOR_META } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

type SubjectCardProps = {
  subject: Subject;
  topicCount?: number;
  masteredCount?: number;
};

export function SubjectCard({
  subject,
  topicCount = 0,
  masteredCount = 0,
}: SubjectCardProps) {
  const meta = SUBJECT_COLOR_META[subject.color];

  return (
    <Link
      href={`/subjects/${subject.id}`}
      className={cn(
        "studi-panel group block p-5 transition-colors hover:bg-card",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className="mt-1 size-3.5 rounded-full"
          style={{ background: meta.swatch }}
          aria-hidden
        />
        {subject.difficulty ? (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Diff {subject.difficulty}/5
          </span>
        ) : null}
      </div>
      <h2 className="font-display text-xl tracking-tight transition-transform group-hover:-translate-y-0.5">
        {subject.name}
      </h2>
      {subject.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {subject.description}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No description yet</p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        {topicCount === 0
          ? "No topics yet"
          : `${masteredCount}/${topicCount} topics mastered`}
      </p>
    </Link>
  );
}
