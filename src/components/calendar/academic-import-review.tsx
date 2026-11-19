"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  listAcademicSuggestionsAction,
  resolveAcademicSuggestionAction,
  type AcademicSuggestionView,
} from "@/actions/external-calendar";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { primaryPillClass, softPillClass } from "@/components/studi/page-title";
import type { Assessment, Subject } from "@/types/database";

export function AcademicImportReview({
  open,
  onOpenChange,
  subjects,
  assessments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  assessments: Assessment[];
}) {
  const [suggestions, setSuggestions] = useState<AcademicSuggestionView[]>([]);
  const [pending, startTransition] = useTransition();
  const [subjectByEvent, setSubjectByEvent] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    startTransition(async () => {
      const result = await listAcademicSuggestionsAction();
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSuggestions(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Possible exams & deadlines"
      description="Conservative suggestions from your connected calendars. Nothing is imported until you confirm."
      className="md:w-[min(560px,calc(100vw-48px))]"
      contentClassName="px-5 pb-5 md:px-6"
    >
      {suggestions.length === 0 ? (
        <p className="text-[14px] text-ink-2">
          {pending
            ? "Looking for academic-looking events…"
            : "No unreviewed suggestions right now."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {suggestions.map((s) => {
            return (
              <li
                key={s.eventId}
                className="rounded-[16px] border border-hairline bg-raised p-3"
              >
                <p className="text-[14px] font-semibold text-ink">{s.title}</p>
                <p className="text-[12.5px] text-ink-2">
                  {s.reason} · {s.confidence} confidence · proposed{" "}
                  {s.proposedType}
                </p>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  {s.allDay || !s.startsAt
                    ? s.startsAt.slice(0, 10)
                    : new Date(s.startsAt).toLocaleString()}
                </p>
                <label className="mt-2 flex flex-col gap-1">
                  <span className="text-[12px] font-semibold text-ink-3">
                    Subject (optional)
                  </span>
                  <select
                    className="h-10 rounded-[10px] border border-hairline bg-canvas px-2 text-[13px]"
                    value={subjectByEvent[s.eventId] ?? ""}
                    onChange={(e) =>
                      setSubjectByEvent((prev) => ({
                        ...prev,
                        [s.eventId]: e.target.value,
                      }))
                    }
                  >
                    <option value="">No subject</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={primaryPillClass}
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await resolveAcademicSuggestionAction({
                          externalEventId: s.eventId,
                          action:
                            s.kind === "assignment" ? "create_task" : "create_exam",
                          subjectId: subjectByEvent[s.eventId] || null,
                          title: s.title,
                          assessmentType:
                            s.kind === "exam"
                              ? (s.proposedType as
                                  | "final"
                                  | "midterm"
                                  | "quiz"
                                  | "other")
                              : "assignment",
                        });
                        if (!result.ok) toast.error(result.error);
                        else {
                          toast.success(result.success);
                          setSuggestions((prev) =>
                            prev.filter((x) => x.eventId !== s.eventId),
                          );
                        }
                      });
                    }}
                  >
                    {s.kind === "assignment" ? "Create task" : "Create in Studi"}
                  </button>
                  {assessments.length > 0 ? (
                    <select
                      className="h-10 max-w-[180px] rounded-full border border-hairline bg-sunken px-3 text-[12.5px]"
                      defaultValue=""
                      onChange={(e) => {
                        const assessmentId = e.target.value;
                        if (!assessmentId) return;
                        startTransition(async () => {
                          const result = await resolveAcademicSuggestionAction({
                            externalEventId: s.eventId,
                            action: "link_assessment",
                            assessmentId,
                          });
                          if (!result.ok) toast.error(result.error);
                          else {
                            toast.success(result.success);
                            setSuggestions((prev) =>
                              prev.filter((x) => x.eventId !== s.eventId),
                            );
                          }
                        });
                      }}
                    >
                      <option value="">Link existing…</option>
                      {assessments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    className={softPillClass}
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await resolveAcademicSuggestionAction({
                          externalEventId: s.eventId,
                          action: "ignore",
                        });
                        if (!result.ok) toast.error(result.error);
                        else {
                          setSuggestions((prev) =>
                            prev.filter((x) => x.eventId !== s.eventId),
                          );
                        }
                      });
                    }}
                  >
                    Keep as external only
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ResponsiveDialog>
  );
}
