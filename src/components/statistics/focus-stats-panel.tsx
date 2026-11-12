import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { formatDurationMinutes } from "@/lib/focus/timer-engine";
import type { FocusStats } from "@/lib/data/focus";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

type FocusStatsPanelProps = {
  stats: FocusStats;
  subjects: Subject[];
};

export function FocusStatsPanel({ stats, subjects }: FocusStatsPanelProps) {
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.seconds));
  const subjectName = (id: string | null) =>
    id ? subjects.find((s) => s.id === id)?.name ?? "Unknown" : "No subject";

  if (stats.sessionCount === 0) {
    return (
      <div className="studi-panel px-6 py-14 text-center">
        <h2 className="font-display text-2xl tracking-tight">No focus data yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Statistics appear after you finish and save a Focus session. Nothing
          is estimated or fabricated.
        </p>
        <Link
          href="/focus"
          className={cn(buttonVariants(), "mt-6 inline-flex")}
        >
          Start focusing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Today"
          value={formatDurationMinutes(stats.todaySeconds * 1000)}
        />
        <Stat
          label="This week"
          value={formatDurationMinutes(stats.weekSeconds * 1000)}
        />
        <Stat
          label="Total focus"
          value={formatDurationMinutes(stats.totalSeconds * 1000)}
        />
        <Stat
          label="Sessions"
          value={String(stats.sessionCount)}
          hint={`Avg ${formatDurationMinutes(stats.averageSeconds * 1000)}`}
        />
      </div>

      {stats.weeklyGoalHours != null ? (
        <section className="studi-panel p-5">
          <h2 className="font-display text-xl tracking-tight">
            Weekly goal
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDurationMinutes(stats.weekSeconds * 1000)} of{" "}
            {stats.weeklyGoalHours}h
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{
                width: `${Math.round((stats.weekGoalProgress ?? 0) * 100)}%`,
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="studi-panel p-5">
        <h2 className="font-display text-xl tracking-tight">
          Daily activity
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Last 28 days · focus time only
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {stats.daily.map((day) => {
            const intensity = day.seconds / maxDaily;
            return (
              <div
                key={day.date}
                title={`${day.date}: ${formatDurationMinutes(day.seconds * 1000)}`}
                className="size-3.5 rounded-sm sm:size-4"
                style={{
                  background:
                    day.seconds === 0
                      ? "color-mix(in oklch, var(--muted) 80%, transparent)"
                      : `color-mix(in oklch, var(--primary) ${Math.max(18, intensity * 100)}%, transparent)`,
                }}
              />
            );
          })}
        </div>
      </section>

      <section className="studi-panel p-5">
        <h2 className="font-display text-xl tracking-tight">
          Time by subject
        </h2>
        {stats.bySubject.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No subject-linked sessions yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {stats.bySubject.map((row) => (
              <li
                key={row.subjectId ?? "none"}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{subjectName(row.subjectId)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatDurationMinutes(row.seconds * 1000)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="studi-panel p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl tracking-tight">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
