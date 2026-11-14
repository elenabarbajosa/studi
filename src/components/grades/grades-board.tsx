"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";

import { EmptyPanel } from "@/components/studi/progress-bits";
import { formatGradeDisplay, toGradeSchemeInput } from "@/lib/grades/convert";
import { aggregateComparableGradedAverages, summarizeGrades } from "@/lib/grades/math";
import type { SubjectGradeBundle } from "@/lib/grades/convert";
import { subjectTone, subjectToneVars } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Assessment, Subject } from "@/types/database";

type GradesBoardProps = {
  subjects: Subject[];
  bundles: SubjectGradeBundle[];
  assessments: Assessment[];
};

export function GradesBoard({ subjects, bundles, assessments }: GradesBoardProps) {
  const bundleBySubject = new Map(bundles.map((b) => [b.scheme.subject_id, b]));

  const cards = subjects.map((subject) => {
    const bundle = bundleBySubject.get(subject.id) ?? null;
    const summary = bundle
      ? summarizeGrades(toGradeSchemeInput(bundle))
      : null;
    const next = assessments
      .filter(
        (a) =>
          a.subject_id === subject.id &&
          !a.completed &&
          new Date(a.starts_at).getTime() >= Date.now() - 86400000,
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      )[0];

    return { subject, bundle, summary, next };
  });

  const configured = cards.filter((c) => c.bundle);
  const aggregation = aggregateComparableGradedAverages(
    configured.map((c) => ({
      displayScaleMax: Number(c.bundle!.scheme.display_scale_max),
      gradedWorkAverage: c.summary?.gradedWorkAverage ?? null,
    })),
  );

  if (!subjects.length) {
    return (
      <EmptyPanel
        icon={Calculator}
        title="Add a subject first"
        body="Grades live on your subjects. Create a course, then configure its weighting."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="type-page text-ink">Grades</h1>
        <p className="max-w-xl text-[14px] text-ink-2">
          Track weighted assessments, secured points, and what-if scenarios. Pending
          work is never treated as zero.
        </p>
      </header>

      <div className="rounded-[22px] bg-sunken px-4 py-4 md:px-5">
        <p className="text-[12px] font-semibold tracking-[0.05em] text-ink-3 uppercase">
          Cross-subject snapshot
        </p>
        {aggregation.comparable && aggregation.average != null ? (
          <p className="mt-1 text-[28px] font-semibold tabular-nums text-ink">
            {formatGradeDisplay(aggregation.average)}%
            <span className="ml-2 text-[13px] font-medium text-ink-2">
              mean graded-work average
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[14px] text-ink-2">{aggregation.reason}</p>
        )}
        {aggregation.comparable ? (
          <p className="mt-1 text-[12.5px] text-ink-3">{aggregation.reason}</p>
        ) : null}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ subject, bundle, summary, next }) => {
          const tone = subjectTone(subject.color);
          return (
            <li key={subject.id}>
              <Link
                href={`/subjects/${subject.id}?tab=grades`}
                className={cn(
                  "flex h-full flex-col gap-3 rounded-[22px] border border-hairline bg-raised p-4 outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                )}
                style={subjectToneVars(subject.color) as CSSProperties}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: tone.dot }}
                    aria-hidden
                  />
                  <span className="truncate text-[15px] font-semibold text-ink">
                    {subject.name}
                  </span>
                </div>

                {!bundle || !summary ? (
                  <p className="text-[13.5px] text-ink-2">Not configured yet</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
                          Graded avg
                        </p>
                        <p className="text-[20px] font-semibold tabular-nums text-ink">
                          {summary.gradedWorkAverage == null
                            ? "—"
                            : `${formatGradeDisplay(summary.gradedWorkAverage)}%`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
                          Secured
                        </p>
                        <p className="text-[20px] font-semibold tabular-nums text-ink">
                          {formatGradeDisplay(summary.securedPoints)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[12.5px] text-ink-2">
                      {formatGradeDisplay(summary.completedWeight)}% weight done ·{" "}
                      {summary.schemeComplete ? "scheme complete" : "draft scheme"}
                      {summary.pass
                        ? summary.pass.passes
                          ? " · on track to pass"
                          : " · requirements unmet in current projection"
                        : ""}
                    </p>
                  </>
                )}

                {next ? (
                  <p className="mt-auto text-[12.5px] text-ink-3">
                    Next exam: {next.title}
                  </p>
                ) : (
                  <p className="mt-auto text-[12.5px] text-ink-3">No upcoming exam linked</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
