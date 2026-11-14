import { CalendarClock } from "lucide-react";

import { ProgressRing } from "@/components/dashboard/progress-ring";
import { DateBadge, SegmentBar } from "@/components/studi/progress-bits";
import { ASSESSMENT_TYPE_META } from "@/lib/calendar";
import {
  subjectTone,
  topicProgressSummary,
  TOPIC_STATUS_META,
  TOPIC_STATUSES,
  type SubjectColor,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Assessment, Topic } from "@/types/database";

import { countdownLabel } from "./assessments-panel";
import { TOPIC_STATUS_STYLE } from "./topics-panel";

function percentOf(ratio: number | null) {
  return ratio == null ? null : Math.round(ratio * 100);
}

/** Aside card: weighted completion ring plus the three status counts. */
export function SubjectProgressCard({ topics, color }: { topics: Topic[]; color: SubjectColor }) {
  const summary = topicProgressSummary(topics);
  const percent = percentOf(summary.completionRatio);
  const tone = subjectTone(color);

  return (
    <section aria-labelledby="progress-card-title" className="rounded-[24px] bg-raised p-5 shadow-[0_0_0_1px_var(--hairline)]">
      <h2 id="progress-card-title" className="text-[13px] font-semibold text-ink-2">
        Progress
      </h2>
      <div
        className="mt-3 flex items-center gap-4"
        style={{ "--ring-tone": tone.dot } as React.CSSProperties}
      >
        <ProgressRing
          size={92}
          radius={40}
          stroke={8}
          value={summary.completionRatio ?? 0}
          trackClassName="stroke-sunken"
          indicatorClassName="stroke-(--ring-tone)"
        >
          <span className="text-[22px] font-semibold tabular-nums text-ink">
            {percent == null ? "—" : `${percent}%`}
          </span>
        </ProgressRing>
        <dl className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px]">
          <Legend label="Mastered" value={summary.mastered} className="bg-success" />
          <Legend label="In progress" value={summary.inProgress} className="bg-warning" />
          <Legend label="Not started" value={summary.notStarted} className="bg-ink-4" />
        </dl>
      </div>
      {summary.total > 0 ? (
        <SegmentBar
          total={summary.total}
          filled={summary.mastered}
          color={tone.dot}
          className="mt-4"
        />
      ) : null}
      <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
        {summary.total === 0
          ? "Add topics to start tracking progress."
          : "Weighted from top-level topic statuses."}
      </p>
    </section>
  );
}

function Legend({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} />
      <dt className="flex-1 text-ink-2">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** Dark ink card for the nearest open exam, as in the handoff's detail panel. */
export function NextExamCard({
  assessment,
  days,
  onOpen,
}: {
  assessment: Assessment | null;
  days: number | null;
  onOpen?: () => void;
}) {
  if (!assessment || days == null) {
    return (
      <section className="flex items-center gap-3 rounded-[24px] bg-sunken p-5">
        <CalendarClock className="size-5 shrink-0 text-ink-3" aria-hidden />
        <p className="text-[13.5px] text-ink-2">No upcoming exams or deadlines.</p>
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3.5 rounded-[24px] bg-[#1f1a1d] p-5 text-left text-white outline-none transition-transform duration-200 ease-studi hover:-translate-y-0.5 focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] motion-reduce:hover:translate-y-0 dark:bg-white/[0.07] dark:shadow-[0_0_0_1px_var(--hairline)]"
    >
      <DateBadge iso={assessment.starts_at} tone="ink" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-white/60 uppercase">Next exam</span>
        <span className="truncate text-[15px] font-semibold">{assessment.title}</span>
        <span className="truncate text-[12.5px] text-white/70">
          {ASSESSMENT_TYPE_META[assessment.assessment_type].label} · {countdownLabel(days)}
        </span>
      </span>
    </button>
  );
}

/** Progress tab: status breakdown across every topic, including subtopics. */
export function SubjectProgress({ topics }: { topics: Topic[] }) {
  const summary = topicProgressSummary(topics);
  const percent = percentOf(summary.completionRatio);
  const counts = TOPIC_STATUSES.map((status) => ({
    status,
    roots: topics.filter((t) => t.parent_id === null && t.status === status).length,
    all: topics.filter((t) => t.status === status).length,
  }));
  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-4">
      <div>
        <h2 id="progress-title" className="text-[15px] font-semibold text-ink">
          Progress
        </h2>
        <p className="text-[12.5px] text-ink-2">
          Based only on your topic statuses: {TOPIC_STATUS_META.not_started.label} counts 0,{" "}
          {TOPIC_STATUS_META.mastered.label} counts fully.
        </p>
      </div>

      {summary.total === 0 ? (
        <p className="rounded-[16px] bg-sunken px-4 py-3 text-[13.5px] text-ink-2">
          Add topics to start tracking real progress.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-none font-semibold tracking-tight tabular-nums text-ink">
              {percent}%
            </span>
            <span className="text-[13px] text-ink-2">weighted completion</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
            {counts.map(({ status, roots }) =>
              roots > 0 ? (
                <span
                  key={status}
                  className={cn("h-full", STATUS_BAR[status])}
                  style={{ width: `${(roots / summary.total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {counts.map(({ status, roots, all }) => {
              const Icon = TOPIC_STATUS_STYLE[status].icon;
              return (
                <li key={status} className="flex items-center gap-3 rounded-[16px] bg-sunken px-4 py-3">
                  <Icon className={cn("size-4 shrink-0", TOPIC_STATUS_STYLE[status].icon_cls)} aria-hidden />
                  <span className="flex-1 text-[13.5px] text-ink">{TOPIC_STATUS_META[status].label}</span>
                  <span className="text-[15px] font-semibold tabular-nums text-ink">{roots}</span>
                  {all > roots ? (
                    <span className="text-[12px] text-ink-3 tabular-nums">
                      +{all - roots} {all - roots === 1 ? "subtopic" : "subtopics"}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

const STATUS_BAR: Record<(typeof TOPIC_STATUSES)[number], string> = {
  mastered: "bg-success",
  practicing: "bg-warning",
  studying: "bg-accent",
  not_started: "bg-transparent",
};
