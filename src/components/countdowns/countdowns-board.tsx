"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, GraduationCap } from "lucide-react";

import { PageTitle } from "@/components/studi/page-title";
import { Segmented } from "@/components/studi/segmented";
import { NativeSelect } from "@/components/studi/form-controls";
import {
  ASSESSMENT_TYPE_META,
  ASSESSMENT_TYPES,
  type AssessmentType,
} from "@/lib/calendar";
import {
  assessmentCountdown,
  type CountdownMode,
} from "@/lib/countdown";
import { subjectToneVars, type SubjectColorValue } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Assessment, Subject } from "@/types/database";

export type CountdownRow = {
  assessment: Assessment;
  subjectName: string | null;
  subjectColor: SubjectColorValue | null;
  href: string;
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function CountdownsBoard({
  upcoming,
  past,
  subjects,
  timeZone,
}: {
  upcoming: CountdownRow[];
  past: CountdownRow[];
  subjects: Subject[];
  timeZone: string;
}) {
  const [mode, setMode] = useState<CountdownMode>("days");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<AssessmentType | "">("");
  const [now, setNow] = useState(() => new Date());
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const filteredUpcoming = useMemo(
    () =>
      upcoming.filter((row) => {
        if (subjectId && row.assessment.subject_id !== subjectId) return false;
        if (type && row.assessment.assessment_type !== type) return false;
        return true;
      }),
    [upcoming, subjectId, type],
  );
  const filteredPast = useMemo(
    () =>
      past.filter((row) => {
        if (subjectId && row.assessment.subject_id !== subjectId) return false;
        if (type && row.assessment.assessment_type !== type) return false;
        return true;
      }),
    [past, subjectId, type],
  );

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5 pb-28 md:pb-10">
      <PageTitle
        title="Countdowns"
        subtitle="Every upcoming exam and deadline, sorted by nearest."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Segmented
          label="Countdown style"
          value={mode}
          onChange={setMode}
          options={[
            { value: "days", label: "Days" },
            { value: "detailed", label: "Detailed" },
          ]}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <NativeSelect
            aria-label="Filter by subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="h-10 min-w-0 sm:w-44"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filter by type"
            value={type}
            onChange={(e) => setType(e.target.value as AssessmentType | "")}
            className="h-10 min-w-0 sm:w-44"
          >
            <option value="">All types</option>
            {ASSESSMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSESSMENT_TYPE_META[t].label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {filteredUpcoming.length === 0 ? (
        <EmptyCountdowns hasFilters={Boolean(subjectId || type)} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filteredUpcoming.map((row) => (
            <li key={row.assessment.id}>
              <CountdownCard
                row={row}
                mode={mode}
                timeZone={timeZone}
                now={now}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="text-[13.5px] font-semibold text-accent-text outline-none hover:underline"
        >
          {showPast ? "Hide past & completed" : "Show past & completed"}
        </button>
        {showPast ? (
          filteredPast.length === 0 ? (
            <p className="mt-3 text-[13.5px] text-ink-2">No past assessments match these filters.</p>
          ) : (
            <ul className="mt-3 grid gap-3 opacity-90 sm:grid-cols-2">
              {filteredPast.map((row) => (
                <li key={row.assessment.id}>
                  <CountdownCard
                    row={row}
                    mode={mode}
                    timeZone={timeZone}
                    now={now}
                    muted
                  />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}

function CountdownCard({
  row,
  mode,
  timeZone,
  now,
  muted,
}: {
  row: CountdownRow;
  mode: CountdownMode;
  timeZone: string;
  now: Date;
  muted?: boolean;
}) {
  const { assessment } = row;
  const parts = assessmentCountdown({
    startsAt: assessment.starts_at,
    allDay: assessment.all_day,
    timeZone,
    now,
  });
  const tone = row.subjectColor
    ? {
        className: "subject-tone",
        style: subjectToneVars(row.subjectColor) as React.CSSProperties,
      }
    : { className: "bg-sunken text-ink-2", style: undefined };

  const when = assessment.all_day
    ? `${DATE_FMT.format(new Date(assessment.starts_at))} · All day`
    : `${DATE_FMT.format(new Date(assessment.starts_at))} · ${TIME_FMT.format(new Date(assessment.starts_at))}`;

  const headline =
    mode === "detailed" && parts.hasTime && !parts.isPast
      ? parts.detailedLabel
      : parts.daysLabel;

  return (
    <Link
      href={row.href}
      className={cn(
        "flex min-h-[148px] flex-col justify-between gap-3 rounded-[22px] p-4 outline-none transition-[filter] hover:brightness-[.97] focus-visible:ring-2 focus-visible:ring-ring dark:hover:brightness-110",
        tone.className,
        muted && "opacity-75",
      )}
      style={tone.style}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {headline}
        </span>
        <GraduationCap className="size-5 shrink-0 opacity-70" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-ink">{assessment.title}</p>
        <p className="mt-0.5 truncate text-[12.5px]">
          {ASSESSMENT_TYPE_META[assessment.assessment_type].label}
          {row.subjectName ? ` · ${row.subjectName}` : ""}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] opacity-80">
          <Calendar className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{when}</span>
        </p>
        {mode === "detailed" && !parts.hasTime && !parts.isPast ? (
          <p className="mt-1.5 text-[11.5px] leading-snug opacity-80">{parts.detailedLabel}</p>
        ) : null}
      </div>
    </Link>
  );
}

function EmptyCountdowns({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[22px] bg-sunken px-5 py-8">
      <p className="text-[16px] font-semibold text-ink">
        {hasFilters ? "No matching countdowns" : "No exams ahead"}
      </p>
      <p className="max-w-md text-[13.5px] leading-snug text-ink-2">
        {hasFilters
          ? "Try clearing the subject or type filter."
          : "Add exams and deadlines on a subject page — they’ll appear here with live countdowns."}
      </p>
      <Link
        href="/subjects"
        className="mt-2 inline-flex h-9 items-center rounded-full bg-raised px-3.5 text-[13.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Go to Subjects
      </Link>
    </div>
  );
}
