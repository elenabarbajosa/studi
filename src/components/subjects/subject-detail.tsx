"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSubject } from "@/actions/subjects";
import { MaterialsPanel } from "@/components/subjects/materials-panel";
import { SubjectForm } from "@/components/subjects/subject-form";
import { SubjectProgress } from "@/components/subjects/subject-progress";
import { TopicsPanel } from "@/components/subjects/topics-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { SUBJECT_COLOR_META, topicProgressSummary } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Material, Subject, Topic } from "@/types/database";

type SubjectDetailProps = {
  subject: Subject;
  topics: Topic[];
  materials: Material[];
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "topics", label: "Topics & Checklist" },
  { id: "materials", label: "Materials" },
  { id: "progress", label: "Progress" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function SubjectDetail({
  subject,
  topics,
  materials,
}: SubjectDetailProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const summary = topicProgressSummary(topics);
  const color = SUBJECT_COLOR_META[subject.color];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/subjects"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-4 gap-2 px-0",
          )}
        >
          <ArrowLeft className="size-4" />
          All subjects
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="mt-2 size-4 rounded-full"
              style={{ background: color.swatch }}
            />
            <div>
              <h1 className="font-display text-3xl tracking-tight md:text-4xl">
                {subject.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {subject.difficulty
                  ? `Difficulty ${subject.difficulty}/5 · `
                  : null}
                {summary.total === 0
                  ? "No topics yet"
                  : `${summary.mastered}/${summary.total} topics mastered`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            className="gap-2"
            onClick={() => {
              if (
                !confirm(
                  `Delete “${subject.name}”? Topics and materials will be removed.`,
                )
              ) {
                return;
              }
              startTransition(async () => {
                const result = await deleteSubject(subject.id);
                if (result.error) toast.error(result.error);
              });
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "bg-brand-soft font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          {editing ? (
            <div className="studi-panel p-6">
              <SubjectForm
                subject={subject}
                onCancel={() => setEditing(false)}
              />
            </div>
          ) : (
            <div className="studi-panel space-y-4 p-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Description
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  {subject.description || "No description yet."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Topics" value={String(summary.total)} />
                <MiniStat label="Materials" value={String(materials.length)} />
                <MiniStat
                  label="Mastered"
                  value={
                    summary.total === 0
                      ? "—"
                      : `${summary.mastered}/${summary.total}`
                  }
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Edit subject
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {tab === "topics" ? (
        <TopicsPanel subjectId={subject.id} topics={topics} />
      ) : null}
      {tab === "materials" ? (
        <MaterialsPanel
          subjectId={subject.id}
          materials={materials}
          topics={topics}
        />
      ) : null}
      {tab === "progress" ? <SubjectProgress topics={topics} /> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
