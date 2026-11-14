"use client";

import { CalendarDays, Plus } from "lucide-react";

import { EventChip } from "@/components/calendar/event-chip";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { softPillClass } from "@/components/studi/page-title";
import { itemsOnDay, type CalItem } from "@/lib/calendar-items";
import { relativeDayLabel } from "@/lib/dashboard";
import { addDays, formatTime, startOfDay } from "@/lib/planning";
import { cn } from "@/lib/utils";

const DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function timeRangeLabel(item: CalItem) {
  if (item.allDay) return "All day";
  if (!item.end || item.source === "task") return formatTime(item.start);
  return `${formatTime(item.start)}–${formatTime(item.end)}`;
}

export function sortDayItems(items: readonly CalItem[]) {
  return [...items].sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

/** Day-grouped list of what is coming up, starting at `start`. */
export function AgendaList({
  items,
  start,
  days,
  onOpenItem,
  onNew,
  compact,
}: {
  items: readonly CalItem[];
  start: Date;
  days: number;
  onOpenItem: (item: CalItem) => void;
  onNew: () => void;
  compact?: boolean;
}) {
  const first = startOfDay(start);
  const groups = Array.from({ length: days }, (_, i) => {
    const day = addDays(first, i);
    return { day, items: sortDayItems(itemsOnDay(items, day)) };
  }).filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyPanel
        icon={CalendarDays}
        title="Nothing planned"
        body={`No exams, sessions, tasks or events in the next ${days} days.`}
        action={
          <button type="button" onClick={onNew} className={softPillClass}>
            <Plus className="size-[15px]" aria-hidden />
            Plan something
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ day, items: dayItems }) => {
        const relative = relativeDayLabel(day.toISOString());
        const isNamed = relative === "Today" || relative === "Tomorrow" || relative === "Yesterday";
        return (
          <section key={day.toISOString()} aria-label={DATE.format(day)}>
            <h3 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold text-ink">
              {isNamed ? relative : DATE.format(day)}
              {isNamed ? <span className="font-medium text-ink-3">{DATE.format(day)}</span> : null}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {dayItems.map((item) => (
                <li key={item.id} className="flex items-stretch gap-3">
                  <span
                    className={cn(
                      "shrink-0 pt-2.5 text-[12.5px] text-ink-2 tabular-nums",
                      compact ? "w-11" : "w-[88px]",
                    )}
                  >
                    {compact && !item.allDay ? formatTime(item.start) : timeRangeLabel(item)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    className="min-h-12 min-w-0 flex-1 rounded-[14px] text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
                  >
                    <EventChip
                      item={item}
                      density="card"
                      timeText={compact && !item.allDay ? timeRangeLabel(item) : undefined}
                      className="min-h-12 items-center"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
