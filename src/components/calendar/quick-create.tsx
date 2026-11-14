"use client";

import { useState, useTransition } from "react";
import { BookOpen, Clock, Flag, GraduationCap, Timer, User } from "lucide-react";
import { toast } from "sonner";

import { createAssessment } from "@/actions/assessments";
import { createPersonalEvent } from "@/actions/calendar-events";
import { createStudySession } from "@/actions/study-sessions";
import type { CalendarDraft } from "@/components/calendar/event-form-dialog";
import { FormError, NativeSelect } from "@/components/studi/form-controls";
import { Segmented } from "@/components/studi/segmented";
import { SubjectPicker } from "@/components/studi/subject-chip";
import { ASSESSMENT_TYPE_META, type AssessmentType } from "@/lib/calendar";
import { DEADLINE_TYPES, EXAM_TYPES } from "@/lib/calendar-items";
import { cn } from "@/lib/utils";
import type { Subject, Topic } from "@/types/database";

export type QuickDraft = {
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  subjectId?: string;
};

type QuickKind = "study" | "exam" | "deadline" | "event";

const KIND_OPTIONS = [
  { value: "study" as const, label: "Study", icon: Timer },
  { value: "exam" as const, label: "Exam", icon: GraduationCap },
  { value: "deadline" as const, label: "Deadline", icon: Flag },
  { value: "event" as const, label: "Event", icon: User },
];

const inlineInput =
  "h-9 min-w-0 rounded-[10px] bg-sunken px-2.5 text-[13.5px] text-ink tabular-nums outline-none focus-visible:bg-raised focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]";

/**
 * Compact creation: type, title, when, subject. Everything else lives in
 * the full form behind "More options", which receives what was typed here.
 */
export function QuickCreateForm({
  draft,
  subjects,
  topics,
  onDone,
  onMoreOptions,
}: {
  draft: QuickDraft;
  subjects: Subject[];
  topics: Topic[];
  onDone: () => void;
  onMoreOptions: (draft: CalendarDraft) => void;
}) {
  const [kind, setKind] = useState<QuickKind>("study");
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(draft.subjectId ?? "");
  const [topicId, setTopicId] = useState("");
  const [examType, setExamType] = useState<AssessmentType>("midterm");
  const [deadlineType, setDeadlineType] = useState<AssessmentType>("assignment");
  const [date, setDate] = useState(draft.date);
  const [allDay, setAllDay] = useState(draft.allDay);
  const [startTime, setStartTime] = useState(draft.startTime ?? "10:00");
  const [endTime, setEndTime] = useState(draft.endTime ?? "11:00");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const timed = kind === "study" || !allDay;
  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);
  const assessmentType = kind === "exam" ? examType : deadlineType;

  const submit = () => {
    setError(undefined);
    const fd = new FormData();
    fd.set("date", date);
    if (timed) {
      fd.set("start_time", startTime);
      fd.set("end_time", endTime);
    } else {
      fd.set("all_day", "true");
    }
    startTransition(async () => {
      let result;
      if (kind === "study") {
        fd.set("subject_id", subjectId);
        fd.set("topic_id", topicId);
        fd.set("status", "planned");
        fd.set("notes", title);
        result = await createStudySession({}, fd);
      } else if (kind === "event") {
        fd.set("title", title);
        result = await createPersonalEvent({}, fd);
      } else {
        fd.set("title", title);
        fd.set("subject_id", subjectId);
        fd.set("assessment_type", assessmentType);
        fd.set("priority", "medium");
        result = await createAssessment({}, fd);
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Added to your calendar");
      onDone();
    });
  };

  const moreOptions = () => {
    const base: CalendarDraft = {
      kind: kind === "study" ? "study_session" : kind === "event" ? "personal" : "assessment",
      date,
      allDay: kind === "study" ? false : allDay,
      startTime: timed ? startTime : undefined,
      endTime: timed ? endTime : undefined,
      defaultSubjectId: subjectId || undefined,
      defaultTitle: title || undefined,
      defaultAssessmentType: kind === "exam" || kind === "deadline" ? assessmentType : undefined,
      defaultTopicId: topicId || undefined,
    };
    onMoreOptions(base);
  };

  return (
    <form
      className="studi-quick-create flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Segmented
        label="Entry type"
        value={kind}
        onChange={setKind}
        options={KIND_OPTIONS}
        size="sm"
        stretch
      />

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required={kind !== "study"}
        maxLength={kind === "study" ? 2000 : 120}
        aria-label={kind === "study" ? "Goal or notes" : "Title"}
        placeholder={
          kind === "study"
            ? "What will you cover? (optional)"
            : kind === "exam"
              ? "Exam title, e.g. Midterm 2"
              : kind === "deadline"
                ? "What is due?"
                : "Event title"
        }
        className="h-10 w-full bg-transparent text-[17px] font-semibold tracking-[-0.01em] text-ink outline-none placeholder:font-medium placeholder:text-ink-3"
      />

      {kind === "exam" || kind === "deadline" ? (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type">
          {(kind === "exam" ? EXAM_TYPES : DEADLINE_TYPES).map((t) => {
            const selected = assessmentType === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => (kind === "exam" ? setExamType(t) : setDeadlineType(t))}
                className={cn(
                  "h-8 rounded-full px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                  selected ? "bg-ink text-canvas" : "bg-sunken text-ink-2 hover:bg-hover",
                )}
              >
                {ASSESSMENT_TYPE_META[t].label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 text-[13.5px]">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="size-[15px] shrink-0 text-ink-3" aria-hidden />
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
            className={cn(inlineInput, "w-[9.5rem]")}
          />
          {timed ? (
            <span className="flex items-center gap-1.5">
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Start time"
                className={cn(inlineInput, "w-[5.75rem]")}
              />
              <span className="text-ink-3" aria-hidden>
                →
              </span>
              <input
                type="time"
                required={kind === "study"}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="End time"
                className={cn(inlineInput, "w-[5.75rem]")}
              />
            </span>
          ) : null}
          {kind !== "study" ? (
            <button
              type="button"
              aria-pressed={allDay}
              onClick={() => setAllDay((v) => !v)}
              className={cn(
                "h-8 rounded-full px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                allDay ? "bg-ink text-canvas" : "bg-sunken text-ink-2 hover:bg-hover",
              )}
            >
              All day
            </button>
          ) : null}
        </div>

        {kind !== "event" ? (
          <div className="flex items-start gap-2">
            <BookOpen className="mt-2 size-[15px] shrink-0 text-ink-3" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {subjects.length > 0 ? (
                <SubjectPicker
                  subjects={subjects}
                  value={subjectId}
                  onChange={(id) => {
                    setSubjectId(id);
                    setTopicId("");
                  }}
                  className="max-h-[5.25rem] overflow-y-auto"
                />
              ) : (
                <p className="pt-1.5 text-ink-2">No subjects yet. Add one in Subjects.</p>
              )}
              {kind === "study" && subjectTopics.length > 0 ? (
                <NativeSelect
                  aria-label="Topic"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                >
                  <option value="">Any topic</option>
                  {subjectTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.parent_id ? "↳ " : ""}
                      {t.title}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <FormError message={error} />

      <div className="flex items-center justify-end gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={moreOptions}
          className="h-9 rounded-full px-3.5 text-[13px] font-medium text-ink-2 outline-none hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
        >
          More options
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground outline-none transition-colors hover:bg-accent-ink-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-60 dark:bg-accent dark:text-ink-on-accent"
        >
          {pending ? "Saving…" : "Create ↵"}
        </button>
      </div>
    </form>
  );
}
