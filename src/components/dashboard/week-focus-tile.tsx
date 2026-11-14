import Link from "next/link";
import { Medal, Trophy } from "lucide-react";

import { Tile } from "@/components/dashboard/tile";
import {
  formatBarValue,
  formatFocusDuration,
  type WeekBar,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type WeekFocusData = {
  weekSeconds: number;
  goalHours: number | null;
  bars: WeekBar[];
  challenge: { name: string; percent: number } | null;
  latestBadge: string | null;
};

/** A 4-hour day fills the bar; lighter days scale down from there. */
const FULL_DAY_SECONDS = 4 * 3600;

function barColor(bar: WeekBar) {
  if (bar.isToday) return "bg-primary dark:bg-accent";
  if (bar.seconds > 0) return "bg-accent";
  return "bg-hairline";
}

function goalCopy(weekSeconds: number, goalHours: number | null) {
  if (goalHours == null || goalHours <= 0) return null;
  const pct = Math.round((weekSeconds / (goalHours * 3600)) * 100);
  return `${pct}% of ${goalHours}h goal`;
}

export function WeekFocusTile({ data }: { data: WeekFocusData }) {
  const goal = goalCopy(data.weekSeconds, data.goalHours);

  return (
    <Tile
      variant="data"
      aria-labelledby="week-focus-title"
      className="flex flex-[5_1_320px] flex-col justify-between gap-4 px-6 py-[22px]"
    >
      <div className="flex flex-col gap-1">
        <h2 id="week-focus-title" className="text-sm font-medium text-ink-2">
          Focus this week
        </h2>
        <p className="text-[38px] leading-none font-semibold tracking-[-0.04em] text-ink tabular-nums">
          {formatFocusDuration(data.weekSeconds)}
        </p>
        {goal ? (
          <p className="text-[13.5px] text-ink-2">{goal}</p>
        ) : (
          <p className="text-[13.5px] text-ink-2">
            No weekly goal yet ·{" "}
            <Link
              href="/settings"
              className="font-medium text-accent-text underline-offset-4 hover:underline"
            >
              Set one
            </Link>
          </p>
        )}
      </div>

      <ol aria-label="Focus per day" className="flex h-[110px] items-end gap-2.5">
        {data.bars.map((bar) => (
          <li key={bar.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="sr-only">
              {bar.dayName}
              {bar.isToday ? " (today)" : ""}: {formatFocusDuration(bar.seconds)}
            </span>
            <span aria-hidden className="h-4 text-xs text-ink-2 tabular-nums">
              {formatBarValue(bar.seconds)}
            </span>
            <span
              aria-hidden
              className={cn(
                "w-full rounded-[9px] transition-[height] duration-400 ease-studi motion-reduce:transition-none",
                barColor(bar),
              )}
              style={{
                height: Math.max(6, Math.min(1, bar.seconds / FULL_DAY_SECONDS) * 80),
              }}
            />
            <span
              aria-hidden
              className={cn(
                "text-xs font-semibold",
                bar.isToday ? "text-accent-text" : "text-ink-3",
              )}
            >
              {bar.label}
            </span>
          </li>
        ))}
      </ol>

      {data.challenge || data.latestBadge ? (
        <Link
          href="/progress"
          className="-mx-1 -mb-1 flex items-center gap-2 rounded-xl px-1 py-1 text-[13px] text-ink-2 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          {data.challenge ? (
            <>
              <Trophy className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              <span className="truncate">
                {data.challenge.name} ·{" "}
                <span className="tabular-nums">{data.challenge.percent}%</span>
              </span>
            </>
          ) : (
            <>
              <Medal className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              <span className="truncate">Latest badge · {data.latestBadge}</span>
            </>
          )}
        </Link>
      ) : null}
    </Tile>
  );
}

export function MobileWeekFocusTile({ data }: { data: WeekFocusData }) {
  return (
    <Link
      href="/statistics"
      className="flex min-w-0 flex-col gap-2 rounded-[22px] bg-sunken p-4 outline-none transition-colors active:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-[12.5px] text-ink-2">This week</span>
      <span className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-ink tabular-nums">
        {formatFocusDuration(data.weekSeconds)}
      </span>
      <span className="flex h-[34px] items-end gap-1" aria-hidden>
        {data.bars.map((bar) => (
          <span
            key={bar.key}
            className={cn("flex-1 rounded-[4px]", barColor(bar))}
            style={{
              height: Math.max(4, Math.min(1, bar.seconds / FULL_DAY_SECONDS) * 34),
            }}
          />
        ))}
      </span>
      <span className="sr-only">of focus. Open Statistics.</span>
    </Link>
  );
}
