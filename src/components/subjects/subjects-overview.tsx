"use client";

import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";

import { PageTitle, primaryPillClass } from "@/components/studi/page-title";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { SubjectCard, type SubjectTileData } from "@/components/subjects/subject-card";
import { SubjectForm } from "@/components/subjects/subject-form";
import { cn } from "@/lib/utils";

export function SubjectsOverview({ tiles }: { tiles: SubjectTileData[] }) {
  const [creating, setCreating] = useState(false);
  const topics = tiles.reduce((n, t) => n + t.topicCount, 0);
  const mastered = tiles.reduce((n, t) => n + t.masteredCount, 0);

  const subtitle =
    tiles.length === 0
      ? "Courses, topics and materials in one place"
      : [
          `${tiles.length} ${tiles.length === 1 ? "subject" : "subjects"}`,
          topics > 0 ? `${mastered} of ${topics} topics mastered` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageTitle
        title="Subjects"
        subtitle={subtitle}
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(primaryPillClass, "max-sm:w-10 max-sm:justify-center max-sm:px-0")}
          >
            <Plus className="size-[15px] max-sm:size-[18px]" aria-hidden />
            <span className="max-sm:sr-only">New subject</span>
          </button>
        }
      />

      {tiles.length === 0 ? (
        <div className="rounded-[24px] bg-raised shadow-[0_0_0_1px_var(--hairline)]">
          <EmptyPanel
            icon={BookOpen}
            title="No subjects yet"
            body="Add your first course, then build its topics, materials and exams."
            action={
              <button type="button" onClick={() => setCreating(true)} className={primaryPillClass}>
                <Plus className="size-[15px]" aria-hidden />
                New subject
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
          {tiles.map((tile) => (
            <SubjectCard key={tile.subject.id} {...tile} />
          ))}
        </div>
      )}

      <ResponsiveDialog open={creating} onOpenChange={setCreating} title="New subject">
        {creating ? <SubjectForm onCancel={() => setCreating(false)} /> : null}
      </ResponsiveDialog>
    </div>
  );
}
