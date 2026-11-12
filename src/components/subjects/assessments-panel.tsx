"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import {
  EventFormDialog,
  type CalendarDraft,
} from "@/components/calendar/event-form-dialog";
import { Button } from "@/components/ui/button";
import {
  ASSESSMENT_TYPE_META,
  examCountdown,
  PRIORITY_META,
  toLocalDateInput,
} from "@/lib/calendar";
import type { Assessment, Subject } from "@/types/database";

type AssessmentsPanelProps = {
  subject: Subject;
  assessments: Assessment[];
};

export function AssessmentsPanel({
  subject,
  assessments,
}: AssessmentsPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarDraft | null>(null);

  const sorted = useMemo(
    () =>
      [...assessments].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    [assessments],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Exams and deadlines for this subject. They also appear on your
          calendar.
        </p>
        <Button
          type="button"
          size="sm"
          className="gap-1"
          onClick={() => {
            setDraft({
              kind: "assessment",
              date: toLocalDateInput(new Date().toISOString()),
              allDay: true,
              defaultSubjectId: subject.id,
            });
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="studi-panel px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No assessments yet for {subject.name}.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="studi-panel w-full p-4 text-left transition-colors hover:bg-card"
                onClick={() => {
                  setDraft({
                    kind: "assessment",
                    date: toLocalDateInput(a.starts_at),
                    assessment: a,
                  });
                  setOpen(true);
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ASSESSMENT_TYPE_META[a.assessment_type].label}
                      {" · "}
                      {toLocalDateInput(a.starts_at)}
                      {a.all_day ? " · All day" : ""}
                      {" · "}
                      {PRIORITY_META[a.priority].label}
                      {a.completed ? " · Done" : ""}
                    </p>
                  </div>
                  {!a.completed ? (
                    <span className="rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-primary">
                      {examCountdown(a.starts_at)}
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <EventFormDialog
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        subjects={[subject]}
        topics={[]}
        tasks={[]}
      />
    </div>
  );
}
