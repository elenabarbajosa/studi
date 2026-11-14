"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { addDays, startOfDay, startOfWeek, toDateKey } from "@/lib/planning";
import { cn } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const FULL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Month grid for jumping dates. Highlights today, the selected range
 * (current week or day), and days that carry exams or deadlines.
 */
export function MiniMonth({
  selected,
  rangeStart,
  rangeEnd,
  marked,
  onPick,
  size = "sm",
}: {
  selected: Date;
  rangeStart?: Date;
  rangeEnd?: Date;
  marked?: ReadonlySet<string>;
  onPick: (date: Date) => void;
  size?: "sm" | "lg";
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startOfDay(selected);
    d.setDate(1);
    return d;
  });
  const [syncedFrom, setSyncedFrom] = useState(selected.getTime());
  if (selected.getTime() !== syncedFrom) {
    setSyncedFrom(selected.getTime());
    const d = startOfDay(selected);
    d.setDate(1);
    setViewMonth(d);
  }

  const gridStart = startOfWeek(viewMonth);
  const todayKey = toDateKey(new Date());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  let lastInMonth = 0;
  days.forEach((d, i) => {
    if (d.getMonth() === viewMonth.getMonth()) lastInMonth = i;
  });
  const visible = days.slice(0, Math.ceil((lastInMonth + 1) / 7) * 7);
  const start = rangeStart ? startOfDay(rangeStart).getTime() : null;
  const end = rangeEnd ? startOfDay(rangeEnd).getTime() : null;

  const shift = (months: number) => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + months);
    setViewMonth(d);
  };

  const cell = size === "lg" ? "h-11" : "h-7";
  const dot = size === "lg" ? "size-9 text-[15px]" : "size-6 text-xs";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between pl-1.5">
        <span className={cn("font-semibold text-ink", size === "lg" ? "text-[17px]" : "text-[13px]")}>
          {MONTH.format(viewMonth)}
        </span>
        <span className="flex">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="flex size-8 items-center justify-center rounded-full text-ink-2 outline-none hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">Previous month</span>
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="flex size-8 items-center justify-center rounded-full text-ink-2 outline-none hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
          >
            <ChevronRight className="size-4" aria-hidden />
            <span className="sr-only">Next month</span>
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-3" aria-hidden>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {visible.map((day, i) => {
          const key = toDateKey(day);
          const t = day.getTime();
          const inRange = start !== null && end !== null && t >= start && t <= end;
          const col = i % 7;
          const isToday = key === todayKey;
          const outside = day.getMonth() !== viewMonth.getMonth();
          const isMarked = marked?.has(key);
          return (
            <div
              key={key}
              className={cn(
                "flex items-center justify-center",
                cell,
                inRange && "bg-sunken",
                inRange && (col === 0 || t === start) && "rounded-l-[10px]",
                inRange && (col === 6 || t === end) && "rounded-r-[10px]",
              )}
            >
              <button
                type="button"
                onClick={() => onPick(day)}
                aria-label={`${FULL.format(day)}${isMarked ? ", has exams or deadlines" : ""}`}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex items-center justify-center rounded-full font-medium tabular-nums outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                  dot,
                  isToday
                    ? "bg-primary font-bold text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
                    : isMarked
                      ? "font-bold text-accent-text hover:bg-hover"
                      : outside
                        ? "text-ink-3 hover:bg-hover hover:text-ink-2"
                        : "text-ink hover:bg-hover",
                )}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
