"use client";

import { useMemo } from "react";
import { CalendarClock, Plus } from "lucide-react";

import type { CalendarDraft } from "@/components/calendar/event-form-dialog";
import { DateBadge, EmptyPanel } from "@/components/studi/progress-bits";
import { daysUntil } from "@/lib/dashboard";
import { ASSESSMENT_TYPE_META, PRIORITY_META, toLocalDateInput } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types/database";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function countdownLabel(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

type AssessmentsPanelProps = {
  subjectId: string;
  assessments: Assessment[];
  onOpenDraft: (draft: CalendarDraft) => void;
};

export function AssessmentsPanel({ subjectId, assessments, onOpenDraft }: AssessmentsPanelProps) {
  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const sorted = [...assessments].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
    return {
      upcoming: sorted.filter((a) => !a.completed && daysUntil(a.starts_at, now) >= 0),
      past: sorted.filter((a) => a.completed || daysUntil(a.starts_at, now) < 0).reverse(),
    };
  }, [assessments]);

  const add = () =>
    onOpenDraft({
      kind: "assessment",
      date: toLocalDateInput(new Date().toISOString()),
      allDay: true,
      defaultSubjectId: subjectId,
    });

  return (
    <section aria-labelledby="exams-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="exams-title" className="text-[15px] font-semibold text-ink">
            Exams & deadlines
          </h2>
          <p className="text-[12.5px] text-ink-2">These also appear on your calendar.</p>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13.5px] font-semibold text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-8"
        >
          <Plus className="size-[15px]" aria-hidden />
          Add
        </button>
      </div>

      {assessments.length === 0 ? (
        <EmptyPanel
          compact
          icon={CalendarClock}
          title="No exams or deadlines"
          body="Add the midterm, final or an assignment so Studi can count down to it."
        />
      ) : (
        <>
          {upcoming.length > 0 ? (
            <ul>
              {upcoming.map((a) => (
                <AssessmentRow key={a.id} assessment={a} onOpen={onOpenDraft} />
              ))}
            </ul>
          ) : (
            <p className="rounded-[16px] bg-sunken px-4 py-3 text-[13.5px] text-ink-2">
              Nothing coming up. Past and completed items are below.
            </p>
          )}
          {past.length > 0 ? (
            <div>
              <h3 className="pt-2 pb-1 text-[12px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                Past & done
              </h3>
              <ul>
                {past.map((a) => (
                  <AssessmentRow key={a.id} assessment={a} onOpen={onOpenDraft} muted />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function AssessmentRow({
  assessment: a,
  onOpen,
  muted,
}: {
  assessment: Assessment;
  onOpen: (draft: CalendarDraft) => void;
  muted?: boolean;
}) {
  const days = daysUntil(a.starts_at, new Date());
  const urgent = !muted && days <= 7;
  const when = a.all_day
    ? DATE.format(new Date(a.starts_at))
    : `${DATE.format(new Date(a.starts_at))} · ${TIME.format(new Date(a.starts_at))}`;

  return (
    <li className="border-b border-hairline">
      <button
        type="button"
        onClick={() => onOpen({ kind: "assessment", date: toLocalDateInput(a.starts_at), assessment: a })}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-[14px] px-2 py-2.5 text-left outline-none transition-colors hover:bg-sunken focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
      >
        <DateBadge iso={a.starts_at} className={cn(muted && "opacity-60")} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("truncate text-[14.5px] font-medium", muted ? "text-ink-2" : "text-ink")}>
            {a.title}
          </span>
          <span className="truncate text-[12.5px] text-ink-2">
            {ASSESSMENT_TYPE_META[a.assessment_type].label} · {when}
            {a.priority !== "medium" ? ` · ${PRIORITY_META[a.priority].label} priority` : ""}
          </span>
        </span>
        {muted ? (
          <span className="shrink-0 text-[12px] font-medium text-ink-3">{a.completed ? "Done" : "Passed"}</span>
        ) : (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums",
              urgent ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent-text",
            )}
          >
            {countdownLabel(days)}
          </span>
        )}
      </button>
    </li>
  );
}
