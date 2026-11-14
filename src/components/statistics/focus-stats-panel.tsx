"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, Play } from "lucide-react";

import { Tile, TileHeader } from "@/components/dashboard/tile";
import { PageTitle, primaryPillClass } from "@/components/studi/page-title";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { Segmented } from "@/components/studi/segmented";
import type { FocusStats } from "@/lib/data/focus";
import { formatDurationMinutes } from "@/lib/focus/timer-engine";
import { subjectTone } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

type FocusStatsPanelProps = {
  stats: FocusStats;
  subjects: Subject[];
};

type Range = "14" | "28";

const HEAT_LEVELS = [
  "var(--sunken)",
  "color-mix(in srgb, var(--accent) 45%, var(--sunken))",
  "var(--accent)",
  "color-mix(in srgb, var(--accent-ink) 65%, var(--accent))",
  "var(--accent-ink)",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmt(seconds: number) {
  return formatDurationMinutes(seconds * 1000);
}

function dayOf(iso: string) {
  return new Date(`${iso}T12:00:00`);
}

export function FocusStatsPanel({ stats, subjects }: FocusStatsPanelProps) {
  const [range, setRange] = useState<Range>("14");

  const title = (
    <PageTitle
      title="Statistics"
      subtitle="From saved focus sessions only · breaks excluded"
      actions={
        stats.sessionCount > 0 ? (
          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: "14", label: "14 days" },
              { value: "28", label: "28 days" },
            ]}
          />
        ) : null
      }
    />
  );

  if (stats.sessionCount === 0) {
    return (
      <div className="flex flex-col gap-5">
        {title}
        <Tile className="px-5">
          <EmptyPanel
            icon={BarChart3}
            title="No focus data yet"
            body="Statistics appear after you finish and save a Focus session. Nothing is estimated."
            action={
              <Link href="/focus" className={primaryPillClass}>
                <Play className="size-3.5 fill-current" aria-hidden />
                Start focusing
              </Link>
            }
          />
        </Tile>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {title}
      <StatStrip stats={stats} />
      <div className="grid gap-4 md:gap-5 min-[1100px]:grid-cols-12">
        <DailyChart stats={stats} range={range} className="min-[1100px]:col-span-8" />
        <SubjectBreakdown stats={stats} subjects={subjects} className="min-[1100px]:col-span-4" />
        <ActivityCalendar stats={stats} className="min-[1100px]:col-span-7" />
        <WeeklyTrend stats={stats} className="min-[1100px]:col-span-5" />
      </div>
    </div>
  );
}

function StatStrip({ stats }: { stats: FocusStats }) {
  const items = [
    { label: "Today", value: fmt(stats.todaySeconds), note: null as string | null },
    {
      label: "This week",
      value: fmt(stats.weekSeconds),
      note:
        stats.weeklyGoalHours != null && stats.weekGoalProgress != null
          ? `${Math.round(stats.weekGoalProgress * 100)}% of ${stats.weeklyGoalHours}h goal`
          : null,
    },
    { label: "Last 28 days", value: fmt(stats.totalSeconds), note: null },
    {
      label: "Sessions",
      value: String(stats.sessionCount),
      note: `avg ${fmt(stats.averageSeconds)}`,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-y-4 rounded-[22px] bg-sunken px-1 py-4 md:py-[18px] min-[1100px]:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "flex min-w-0 flex-col gap-0.5 px-4 md:px-[22px]",
            i % 2 === 1 && "border-l border-hairline",
            i === 2 && "min-[1100px]:border-l min-[1100px]:border-hairline",
          )}
        >
          <dt className="text-[13px] font-medium text-ink-2">{item.label}</dt>
          <dd className="truncate text-[26px] leading-[1.1] font-semibold tracking-[-0.04em] text-ink tabular-nums md:text-[34px]">
            {item.value}
          </dd>
          {item.note ? (
            <dd className="truncate text-[12.5px] font-medium text-ink-3">{item.note}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

function DailyChart({
  stats,
  range,
  className,
}: {
  stats: FocusStats;
  range: Range;
  className?: string;
}) {
  const days = stats.daily.slice(-Number(range));
  const target =
    stats.weeklyGoalHours != null && stats.weeklyGoalHours > 0
      ? (stats.weeklyGoalHours * 3600) / 7
      : null;
  const max = Math.max(1, ...days.map((d) => d.seconds), target ?? 0) * 1.2;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dense = days.length > 14;

  return (
    <Tile className={cn("flex flex-col p-5 md:px-[22px]", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="type-tile text-ink">Daily focus</h2>
        <span className="text-[13px] text-ink-2">last {days.length} days</span>
        {target ? (
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <span className="w-4 border-t-[1.5px] border-dashed border-accent-ink dark:border-accent" aria-hidden />
            Daily pace {fmt(target)} ({stats.weeklyGoalHours}h/week)
          </span>
        ) : null}
      </div>
      <div className="relative mt-4 flex h-[180px] items-end gap-[3px] md:h-[210px] md:gap-2">
        {target ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-accent-ink opacity-70 dark:border-accent"
            style={{ bottom: `${(target / max) * 100}%` }}
          />
        ) : null}
        {days.map((d) => {
          const isToday = d.date === todayKey;
          const date = dayOf(d.date);
          return (
            <div
              key={d.date}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${fmt(d.seconds)}`}
            >
              {!dense && d.seconds > 0 ? (
                <span className="text-[11px] whitespace-nowrap text-ink-3 tabular-nums max-md:hidden">
                  {fmt(d.seconds)}
                </span>
              ) : null}
              <div
                className={cn(
                  "w-full max-w-[44px] shrink-0 rounded-[6px] transition-[height] duration-500 ease-studi md:rounded-[10px]",
                  d.seconds === 0
                    ? "bg-sunken"
                    : isToday
                      ? "bg-accent-ink dark:bg-accent"
                      : "bg-[color-mix(in_srgb,var(--accent)_70%,transparent)]",
                )}
                style={{ height: d.seconds === 0 ? 4 : `max(4px, ${(d.seconds / max) * 100}%)` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] md:gap-2" aria-hidden>
        {days.map((d) => {
          const isToday = d.date === todayKey;
          const date = dayOf(d.date);
          const label = dense
            ? date.getDate() % 7 === 1 || isToday
              ? String(date.getDate())
              : ""
            : date.toLocaleDateString(undefined, { weekday: "narrow" });
          return (
            <span
              key={d.date}
              className={cn(
                "h-4 min-w-0 flex-1 text-center text-[11px] font-semibold",
                isToday ? "text-accent-text" : "text-ink-3",
              )}
            >
              {label}
            </span>
          );
        })}
      </div>
      <p className="sr-only">
        {days.map((d) => `${d.date}: ${fmt(d.seconds)}`).join(", ")}
      </p>
    </Tile>
  );
}

function SubjectBreakdown({
  stats,
  subjects,
  className,
}: {
  stats: FocusStats;
  subjects: Subject[];
  className?: string;
}) {
  const total = stats.bySubject.reduce((sum, r) => sum + r.seconds, 0);
  const rows = stats.bySubject.map((row) => {
    const subject = row.subjectId ? subjects.find((s) => s.id === row.subjectId) : undefined;
    return {
      key: row.subjectId ?? "none",
      name: row.subjectId ? subject?.name ?? "Archived subject" : "No subject",
      color: subject ? subjectTone(subject.color).dot : "var(--ink-4)",
      seconds: row.seconds,
      pct: total > 0 ? Math.round((row.seconds / total) * 100) : 0,
    };
  });

  return (
    <Tile className={cn("flex flex-col gap-3 p-5 md:px-[22px]", className)}>
      <TileHeader
        title="By subject"
        action={<span className="text-[13px] text-ink-2 tabular-nums">{fmt(total)}</span>}
      />
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">No sessions in the last 28 days.</p>
      ) : (
        <>
          <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {rows.map((r) => (
              <span key={r.key} style={{ width: `${Math.max(r.pct, 1)}%`, background: r.color }} />
            ))}
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-2.5 text-[13.5px]">
                <span className="size-[9px] shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
                <span className="w-10 text-right text-ink-3 tabular-nums">{r.pct}%</span>
                <strong className="w-14 text-right font-semibold text-ink tabular-nums">{fmt(r.seconds)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-auto pt-1 text-[12px] text-ink-3">Last 28 days</p>
    </Tile>
  );
}

function ActivityCalendar({ stats, className }: { stats: FocusStats; className?: string }) {
  const { weeks, max } = useMemo(() => {
    const first = stats.daily[0] ? dayOf(stats.daily[0].date) : new Date();
    const lead = (first.getDay() + 6) % 7;
    const cells: ({ date: string; seconds: number } | null)[] = [
      ...Array.from({ length: lead }, () => null),
      ...stats.daily,
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const out: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return { weeks: out, max: Math.max(1, ...stats.daily.map((d) => d.seconds)) };
  }, [stats.daily]);

  function level(seconds: number) {
    if (seconds <= 0) return 0;
    return Math.min(4, Math.max(1, Math.ceil((seconds / max) * 4)));
  }

  return (
    <Tile className={cn("flex flex-col gap-3 p-5 md:px-[22px]", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="type-tile text-ink">Activity</h2>
        <span className="text-[13px] text-ink-2">last 4 weeks</span>
        <span className="ml-auto flex items-center gap-1 text-[12px] text-ink-3" aria-hidden>
          Less
          {HEAT_LEVELS.map((c) => (
            <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
          ))}
          More
        </span>
      </div>
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1.5 md:gap-2" role="table" aria-label="Daily focus, last four weeks">
        <div role="row" className="contents">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className="text-center text-[11px] text-ink-3">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div role="row" key={wi} className="contents">
            {week.map((cell, ci) =>
              cell ? (
                <span
                  key={cell.date}
                  role="cell"
                  title={`${dayOf(cell.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${fmt(cell.seconds)}`}
                  aria-label={`${cell.date}: ${fmt(cell.seconds)}`}
                  className="flex h-8 items-center justify-center rounded-[8px] text-[10.5px] font-semibold tabular-nums md:h-9"
                  style={{
                    background: HEAT_LEVELS[level(cell.seconds)],
                    color: level(cell.seconds) >= 3 ? "var(--ink-on-accent)" : "var(--ink-3)",
                  }}
                >
                  {dayOf(cell.date).getDate()}
                </span>
              ) : (
                <span key={`e-${wi}-${ci}`} role="cell" aria-hidden className="h-8 md:h-9" />
              ),
            )}
          </div>
        ))}
      </div>
    </Tile>
  );
}

function WeeklyTrend({ stats, className }: { stats: FocusStats; className?: string }) {
  const weeks = useMemo(() => {
    const out: number[] = [];
    const daily = stats.daily;
    for (let end = daily.length; end > 0; end -= 7) {
      out.unshift(daily.slice(Math.max(0, end - 7), end).reduce((s, d) => s + d.seconds, 0));
    }
    return out;
  }, [stats.daily]);

  const bestDay = useMemo(() => {
    const totals = new Array(7).fill(0) as number[];
    for (const d of stats.daily) totals[(dayOf(d.date).getDay() + 6) % 7] += d.seconds;
    const best = Math.max(...totals);
    if (best <= 0) return "—";
    const idx = totals.indexOf(best);
    return dayOf(stats.daily.find((d) => (dayOf(d.date).getDay() + 6) % 7 === idx)!.date).toLocaleDateString(
      undefined,
      { weekday: "long" },
    );
  }, [stats.daily]);

  const activeDays = stats.daily.filter((d) => d.seconds > 0).length;
  const max = Math.max(1, ...weeks);
  const points = weeks
    .map((w, i) => `${(i / Math.max(1, weeks.length - 1)) * 300},${86 - (w / max) * 76}`)
    .join(" ");

  return (
    <Tile variant="hero" className={cn("flex flex-col gap-3 p-5 md:px-[22px]", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-tile text-ink">Weekly trend</h2>
        <span className="text-[12.5px] text-ink-2">rolling 7-day totals</span>
      </div>
      <svg viewBox="0 0 300 92" className="h-[92px] w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
        <polyline
          points={points}
          fill="none"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-accent-ink dark:stroke-accent"
        />
      </svg>
      <div className="flex justify-between text-[11.5px] text-ink-2 tabular-nums" aria-label="Weekly totals">
        {weeks.map((w, i) => (
          <span key={i}>{fmt(w)}</span>
        ))}
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2">
        <Fact label="Avg session" value={fmt(stats.averageSeconds)} />
        <Fact label="Best day" value={bestDay} />
        <Fact label="Active days" value={`${activeDays} of ${stats.daily.length}`} />
        <Fact
          label="Weekly goal"
          value={
            stats.weekGoalProgress != null ? `${Math.round(stats.weekGoalProgress * 100)}%` : "Not set"
          }
        />
      </dl>
    </Tile>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[12.5px] text-ink-2">{label}</dt>
      <dd className="truncate text-[19px] font-semibold tracking-[-0.02em] text-ink">{value}</dd>
    </div>
  );
}
