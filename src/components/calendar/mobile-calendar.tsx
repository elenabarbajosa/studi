"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";

import { AgendaList, sortDayItems, timeRangeLabel } from "@/components/calendar/agenda-list";
import { EventChip } from "@/components/calendar/event-chip";
import { FilterSwatch } from "@/components/calendar/desktop-calendar";
import { MiniMonth } from "@/components/calendar/mini-month";
import type { QuickDraft } from "@/components/calendar/quick-create";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import {
  CAL_FILTERS,
  filterOfKind,
  itemsOnDay,
  type CalFilter,
  type CalItem,
} from "@/lib/calendar-items";
import { relativeDayLabel } from "@/lib/dashboard";
import { addDays, layoutLanes, startOfDay, startOfWeek, toDateKey } from "@/lib/planning";
import { subjectTone } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const HOUR_PX = 48;
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric" });
const DAY_LABEL = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

function minutesOf(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function hhmm(minutes: number) {
  const m = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const iconButton =
  "flex size-[38px] shrink-0 items-center justify-center rounded-full bg-sunken text-ink outline-none transition-colors active:bg-hover focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] aria-pressed:bg-ink aria-pressed:text-canvas";

export function MobileCalendar({
  items,
  day,
  onDayChange,
  agenda,
  onAgendaChange,
  hidden,
  onToggleFilter,
  onCreate,
  onOpenItem,
  className,
}: {
  items: CalItem[];
  day: Date;
  onDayChange: (day: Date) => void;
  agenda: boolean;
  onAgendaChange: (agenda: boolean) => void;
  hidden: ReadonlySet<CalFilter>;
  onToggleFilter: (filter: CalFilter) => void;
  onCreate: (draft: QuickDraft) => void;
  onOpenItem: (item: CalItem) => void;
  className?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const visible = useMemo(
    () => items.filter((i) => !hidden.has(filterOfKind(i.kind))),
    [items, hidden],
  );
  const weekStart = startOfWeek(day);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = toDateKey(new Date());
  const dayKey = toDateKey(day);
  const dayItems = useMemo(() => sortDayItems(itemsOnDay(visible, startOfDay(day))), [visible, day]);
  const allDay = dayItems.filter((i) => i.allDay);
  const timed = dayItems.filter((i) => !i.allDay);

  const touch = useRef<number | null>(null);
  const shiftWeek = (weeks: number) => onDayChange(addDays(day, weeks * 7));

  const relative = relativeDayLabel(day.toISOString());
  const dayTitle =
    relative === "Today" || relative === "Tomorrow" || relative === "Yesterday"
      ? `${relative} · ${WEEKDAY_LONG.format(day)}`
      : DAY_LABEL.format(day);

  const nextHour = () => {
    const now = new Date();
    const start = dayKey === todayKey ? Math.min(22, now.getHours() + 1) : 10;
    return { startTime: hhmm(start * 60), endTime: hhmm(start * 60 + 60) };
  };

  return (
    <div className={cn("flex-col", className)}>
      <div className="flex items-center justify-between gap-3 pb-1">
        <h1 className="flex min-w-0 items-baseline gap-1.5 text-[28px] leading-tight tracking-[-0.035em]">
          <span className="truncate font-semibold text-ink">{MONTH.format(day)}</span>
          <span className="font-normal text-ink-3">{day.getFullYear()}</span>
        </h1>
        <div className="flex items-center gap-2">
          {dayKey !== todayKey ? (
            <button
              type="button"
              onClick={() => onDayChange(startOfDay(new Date()))}
              className="h-[38px] rounded-full bg-sunken px-3.5 text-[13.5px] font-semibold text-ink outline-none active:bg-hover"
            >
              Today
            </button>
          ) : null}
          <button
            type="button"
            aria-pressed={agenda}
            onClick={() => onAgendaChange(!agenda)}
            className={iconButton}
          >
            <List className="size-[17px]" aria-hidden />
            <span className="sr-only">Agenda list</span>
          </button>
          <button type="button" onClick={() => setPickerOpen(true)} className={iconButton}>
            <CalendarDays className="size-[17px]" aria-hidden />
            <span className="sr-only">Jump to date and filters</span>
          </button>
        </div>
      </div>

      <div
        className="-mx-1 flex items-center"
        onTouchStart={(e) => {
          touch.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const startX = touch.current;
          const endX = e.changedTouches[0]?.clientX;
          touch.current = null;
          if (startX == null || endX == null) return;
          const dx = endX - startX;
          if (Math.abs(dx) > 50) shiftWeek(dx < 0 ? 1 : -1);
        }}
      >
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          className="flex h-[72px] w-5 shrink-0 items-center justify-center text-ink-3 outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="sr-only">Previous week</span>
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5 py-2.5" role="group" aria-label="Week">
          {week.map((d, i) => {
            const key = toDateKey(d);
            const selected = key === dayKey;
            const isToday = key === todayKey;
            const dots = dotsFor(itemsOnDay(visible, d));
            return (
              <button
                key={key}
                type="button"
                onClick={() => onDayChange(d)}
                aria-pressed={selected}
                aria-label={`${DAY_LABEL.format(d)}${dots.count ? `, ${dots.count} items` : ""}`}
                className={cn(
                  "flex h-[72px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]",
                  selected ? "bg-ink text-canvas" : "active:bg-sunken",
                )}
              >
                <span
                  className={cn(
                    "text-[12px] font-semibold",
                    selected ? "text-canvas/80" : isToday ? "text-accent-text" : "text-ink-3",
                  )}
                >
                  {INITIALS[i]}
                </span>
                <span className={cn("text-[19px] leading-none font-semibold tabular-nums", !selected && isToday && "text-accent-text")}>
                  {d.getDate()}
                </span>
                <span className="flex h-[5px] gap-0.5" aria-hidden>
                  {dots.colors.map((c, j) => (
                    <span key={j} className="size-[5px] rounded-full" style={{ background: c }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          className="flex h-[72px] w-5 shrink-0 items-center justify-center text-ink-3 outline-none"
        >
          <ChevronRight className="size-4" aria-hidden />
          <span className="sr-only">Next week</span>
        </button>
      </div>

      {agenda ? (
        <div className="pt-2">
          <AgendaList
            items={visible}
            start={day}
            days={14}
            onOpenItem={onOpenItem}
            onNew={() => onCreate({ date: dayKey, allDay: false, ...nextHour() })}
            compact
          />
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3 pt-1 pb-2">
            <h2 className="text-[15px] font-semibold text-ink">{dayTitle}</h2>
            <span className="shrink-0 text-[13px] text-ink-2">
              {dayItems.length === 0
                ? "Nothing planned"
                : `${dayItems.length} ${dayItems.length === 1 ? "item" : "items"}`}
            </span>
          </div>
          {allDay.length > 0 ? (
            <ul className="mb-2 flex flex-col gap-1.5" aria-label="All day">
              {allDay.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    className="block w-full rounded-[14px] text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]"
                  >
                    <EventChip item={item} density="card" timeText="All day" className="min-h-11 items-center" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <DayTimeline
            items={timed}
            isToday={dayKey === todayKey}
            onOpenItem={onOpenItem}
            onCreateAt={(minutes) =>
              onCreate({ date: dayKey, allDay: false, startTime: hhmm(minutes), endTime: hhmm(minutes + 60) })
            }
          />
        </>
      )}

      <button
        type="button"
        onClick={() => onCreate({ date: dayKey, allDay: false, ...nextHour() })}
        className="fixed right-5 bottom-[calc(88px+env(safe-area-inset-bottom)+16px)] z-30 flex size-14 items-center justify-center rounded-[20px] bg-ink text-canvas shadow-[0_12px_24px_-10px_rgba(36,28,31,0.6)] outline-none transition-transform active:scale-95 focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]"
      >
        <Plus className="size-6" aria-hidden />
        <span className="sr-only">New calendar entry</span>
      </button>

      <ResponsiveDialog open={pickerOpen} onOpenChange={setPickerOpen} title="Jump to date">
        <div className="flex flex-col gap-6 pb-2">
          <MiniMonth
            size="lg"
            selected={day}
            rangeStart={day}
            rangeEnd={day}
            onPick={(d) => {
              onDayChange(d);
              setPickerOpen(false);
            }}
          />
          <fieldset className="flex flex-col">
            <legend className="mb-1 text-[13px] font-semibold text-ink-2">Show</legend>
            {CAL_FILTERS.map((f) => (
              <label key={f.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink">
                <input
                  type="checkbox"
                  checked={!hidden.has(f.value)}
                  onChange={() => onToggleFilter(f.value)}
                  className="size-5"
                />
                <FilterSwatch kind={f.kind} />
                {f.label}
              </label>
            ))}
          </fieldset>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

function dotsFor(items: readonly CalItem[]) {
  const colors: string[] = [];
  for (const item of items) {
    const c = item.color ? subjectTone(item.color).dot : "var(--ink-4)";
    if (!colors.includes(c)) colors.push(c);
    if (colors.length === 3) break;
  }
  return { colors, count: items.length };
}

function DayTimeline({
  items,
  isToday,
  onOpenItem,
  onCreateAt,
}: {
  items: readonly CalItem[];
  isToday: boolean;
  onOpenItem: (item: CalItem) => void;
  onCreateAt: (minutes: number) => void;
}) {
  const laid = useMemo(
    () =>
      layoutLanes(
        items.map((item) => {
          const start = minutesOf(item.start);
          const end = item.end ? Math.max(start + 20, minutesOf(item.end) || 24 * 60) : start + 30;
          return { id: item.id, start, end, item };
        }),
      ),
    [items],
  );

  const firstHour = Math.min(7, ...laid.map((l) => Math.floor(l.start / 60)));
  const lastHour = Math.max(22, ...laid.map((l) => Math.ceil(l.end / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const height = (lastHour - firstHour) * HOUR_PX;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isToday) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [isToday]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowY = ((nowMinutes - firstHour * 60) / 60) * HOUR_PX;

  return (
    <div className="relative mt-1" style={{ height: height + 16 }}>
      {hours.map((h) => (
        <div
          key={h}
          className="pointer-events-none absolute right-0 left-0 flex items-center gap-2"
          style={{ top: (h - firstHour) * HOUR_PX }}
        >
          <span className="w-[38px] shrink-0 -translate-y-px text-[11.5px] text-ink-3 tabular-nums">
            {String(h).padStart(2, "0")}:00
          </span>
          <span className="flex-1 border-t border-hairline" />
        </div>
      ))}
      <button
        type="button"
        aria-label="Add an entry at a time on this day"
        className="absolute top-0 right-0 left-[46px] cursor-copy outline-none"
        style={{ height }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const minutes = firstHour * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60;
          onCreateAt(Math.floor(minutes / 30) * 30);
        }}
      />
      {laid.map(({ item, start, end, lane, lanes }) => {
        const top = ((start - firstHour * 60) / 60) * HOUR_PX + 1;
        const h = Math.max(40, ((end - start) / 60) * HOUR_PX - 3);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenItem(item)}
            className="absolute rounded-[14px] text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]"
            style={{
              top,
              height: h,
              left: `calc(50px + (100% - 50px) * ${lane / lanes})`,
              width: `calc((100% - 50px) / ${lanes} - 4px)`,
            }}
          >
            <EventChip item={item} density="card" timeText={timeRangeLabel(item)} />
          </button>
        );
      })}
      {isToday && nowY >= 0 && nowY <= height ? (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 left-[44px] h-0.5 bg-primary dark:bg-accent"
          style={{ top: nowY }}
        >
          <span className="absolute -top-1 -left-[5px] size-2.5 rounded-full bg-primary dark:bg-accent" />
        </div>
      ) : null}
    </div>
  );
}
