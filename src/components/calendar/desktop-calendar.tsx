"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  DatesSetArg,
  DayCellContentArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, ListFilter, Plus } from "lucide-react";

import { AgendaList } from "@/components/calendar/agenda-list";
import { EventChip } from "@/components/calendar/event-chip";
import { MiniMonth } from "@/components/calendar/mini-month";
import type { QuickDraft } from "@/components/calendar/quick-create";
import { iconPillClass, primaryPillClass, softPillClass } from "@/components/studi/page-title";
import { Segmented } from "@/components/studi/segmented";
import { SubjectDot } from "@/components/studi/subject-chip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toLocalDateInput, toLocalTimeInput } from "@/lib/calendar";
import { CAL_FILTERS, filterOfKind, type CalFilter, type CalItem } from "@/lib/calendar-items";
import { addDays, formatTime, startOfDay, toDateKey } from "@/lib/planning";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

export type BoardView = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "agenda";

const VIEW_OPTIONS: { value: BoardView; label: string }[] = [
  { value: "dayGridMonth", label: "Month" },
  { value: "timeGridWeek", label: "Week" },
  { value: "timeGridDay", label: "Day" },
  { value: "agenda", label: "Agenda" },
];

const AGENDA_DAYS = 14;
const MONTH_NAME = new Intl.DateTimeFormat("en-GB", { month: "long" });
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const DAY_TITLE = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" });

type Range = { start: Date; end: Date; current: Date };

export function FilterSwatch({ kind }: { kind: CalItem["kind"] }) {
  return (
    <span
      aria-hidden
      data-kind={kind}
      className="studi-ev h-[11px] w-[18px] shrink-0 rounded-[4px] border-[1.5px] border-transparent"
    />
  );
}

export function DesktopCalendar({
  items,
  subjects,
  view,
  onViewChange,
  date,
  onDateChange,
  hidden,
  onToggleFilter,
  onSelectRange,
  onOpenItem,
  onMove,
  onNew,
  selectionOpen,
  pending,
  className,
}: {
  items: CalItem[];
  subjects: Subject[];
  view: BoardView;
  onViewChange: (view: BoardView) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  hidden: ReadonlySet<CalFilter>;
  onToggleFilter: (filter: CalFilter) => void;
  onSelectRange: (draft: QuickDraft, rect: DOMRect) => void;
  onOpenItem: (item: CalItem) => void;
  onMove: (
    eventId: string,
    starts_at: string,
    ends_at: string | null,
    all_day: boolean,
    revert: () => void,
  ) => void;
  onNew: () => void;
  selectionOpen: boolean;
  pending: boolean;
  className?: string;
}) {
  const calendarRef = useRef<FullCalendar>(null);
  const [range, setRange] = useState<Range>(() => ({
    start: startOfDay(date),
    end: addDays(startOfDay(date), 6),
    current: date,
  }));

  const visibleItems = useMemo(
    () => items.filter((i) => !hidden.has(filterOfKind(i.kind))),
    [items, hidden],
  );

  const events = useMemo<EventInput[]>(
    () =>
      visibleItems.map((item) => ({
        id: item.id,
        title: item.title,
        start: item.start,
        end: item.end ?? undefined,
        allDay: item.allDay,
        editable: item.editable,
        durationEditable: item.editable && item.source !== "task",
        backgroundColor: "transparent",
        borderColor: "transparent",
        extendedProps: { item },
      })),
    [visibleItems],
  );

  const markedDays = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.kind === "exam" || item.kind === "deadline") {
        set.add(toDateKey(new Date(item.start)));
      }
    }
    return set;
  }, [items]);

  useEffect(() => {
    if (!selectionOpen) calendarRef.current?.getApi().unselect();
  }, [selectionOpen]);

  const api = () => calendarRef.current?.getApi();

  const go = (direction: -1 | 0 | 1) => {
    if (view === "agenda") {
      onDateChange(direction === 0 ? startOfDay(new Date()) : addDays(date, direction * AGENDA_DAYS));
      return;
    }
    const calendar = api();
    if (!calendar) return;
    if (direction === 0) calendar.today();
    else if (direction === 1) calendar.next();
    else calendar.prev();
  };

  const visibleAnchor = () => {
    const calendar = api();
    if (!calendar) return date;
    const { currentStart, currentEnd } = calendar.view;
    const inRange = (d: Date) => d >= currentStart && d < currentEnd;
    const today = new Date();
    if (inRange(today)) return today;
    const current = calendar.getDate();
    return inRange(current) ? current : currentStart;
  };

  const changeView = (next: BoardView) => {
    if (view !== "agenda" && next === "agenda") {
      onDateChange(startOfDay(visibleAnchor()));
    }
    onViewChange(next);
    if (next !== "agenda") api()?.changeView(next, visibleAnchor());
  };

  const pick = (day: Date) => {
    if (view === "agenda") onDateChange(day);
    else api()?.gotoDate(day);
  };

  const datesSet = useCallback(
    (arg: DatesSetArg) => {
      const current = arg.view.calendar.getDate();
      setRange({
        start: arg.view.currentStart,
        end: new Date(arg.view.currentEnd.getTime() - 1),
        current,
      });
      onDateChange(current);
    },
    [onDateChange],
  );

  const select = useCallback(
    (arg: DateSelectArg) => {
      const mirror = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".studi-calendar .fc-event-mirror, .studi-calendar .fc-highlight",
        ),
      ).pop();
      const jsEvent = arg.jsEvent as MouseEvent | null;
      const rect =
        mirror?.getBoundingClientRect() ??
        new DOMRect(jsEvent?.clientX ?? window.innerWidth / 2, jsEvent?.clientY ?? 200, 1, 1);
      const sameDay = toLocalDateInput(arg.start.toISOString());
      onSelectRange(
        {
          date: sameDay,
          allDay: arg.allDay,
          startTime: arg.allDay ? undefined : toLocalTimeInput(arg.start.toISOString()),
          endTime: arg.allDay ? undefined : toLocalTimeInput(arg.end.toISOString()),
        },
        rect,
      );
    },
    [onSelectRange],
  );

  const eventClick = useCallback(
    (arg: EventClickArg) => {
      arg.jsEvent.preventDefault();
      onOpenItem(arg.event.extendedProps.item as CalItem);
    },
    [onOpenItem],
  );

  const onDrop = useCallback(
    (arg: EventDropArg) => {
      const start = arg.event.start;
      if (!start) return arg.revert();
      onMove(arg.event.id, start.toISOString(), arg.event.end?.toISOString() ?? null, arg.event.allDay, arg.revert);
    },
    [onMove],
  );

  const onResize = useCallback(
    (arg: EventResizeDoneArg) => {
      const start = arg.event.start;
      if (!start) return arg.revert();
      onMove(arg.event.id, start.toISOString(), arg.event.end?.toISOString() ?? null, arg.event.allDay, arg.revert);
    },
    [onMove],
  );

  const titleDate = view === "agenda" ? date : midpoint(range);
  const showDay = view === "timeGridDay";

  return (
    <div className={cn("flex-col gap-3.5", className)}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
        <h1 className="flex min-w-0 items-baseline gap-2 text-[26px] leading-none tracking-[-0.035em] md:text-[28px]">
          <span className="font-semibold text-ink">
            {showDay ? DAY_TITLE.format(range.current) : MONTH_NAME.format(titleDate)}
          </span>
          <span className="font-normal text-ink-3">
            {showDay
              ? `${MONTH_NAME.format(range.current)} ${range.current.getFullYear()}`
              : titleDate.getFullYear()}
          </span>
        </h1>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} className={iconPillClass}>
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">Previous</span>
          </button>
          <button type="button" onClick={() => go(0)} className={softPillClass}>
            Today
          </button>
          <button type="button" onClick={() => go(1)} className={iconPillClass}>
            <ChevronRight className="size-4" aria-hidden />
            <span className="sr-only">Next</span>
          </button>
        </div>
        {pending ? (
          <span role="status" className="text-[12.5px] text-ink-3">
            Saving…
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(iconPillClass, "min-[1280px]:hidden", hidden.size > 0 && "bg-accent-soft text-accent-text")}
            >
              <ListFilter className="size-4" aria-hidden />
              <span className="sr-only">Show or hide entry types</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Show</DropdownMenuLabel>
                {CAL_FILTERS.map((f) => (
                  <DropdownMenuCheckboxItem
                    key={f.value}
                    checked={!hidden.has(f.value)}
                    onCheckedChange={() => onToggleFilter(f.value)}
                    closeOnClick={false}
                  >
                    <FilterSwatch kind={f.kind} />
                    {f.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Segmented label="Calendar view" value={view} onChange={changeView} options={VIEW_OPTIONS} />
          <button type="button" onClick={onNew} className={primaryPillClass}>
            <Plus className="size-[15px]" aria-hidden />
            New
          </button>
        </div>
      </div>

      <div className="flex min-h-0 gap-3.5">
        <aside className="hidden w-[220px] shrink-0 flex-col gap-6 pt-1 pr-1 min-[1280px]:flex" aria-label="Calendar options">
          <MiniMonth
            selected={view === "agenda" ? date : range.current}
            rangeStart={view === "agenda" ? date : range.start}
            rangeEnd={view === "agenda" ? addDays(date, AGENDA_DAYS - 1) : view === "dayGridMonth" ? undefined : range.end}
            marked={markedDays}
            onPick={pick}
          />
          <fieldset className="flex flex-col gap-0.5">
            <legend className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Show</legend>
            {CAL_FILTERS.map((f) => (
              <label
                key={f.value}
                className="-mx-1.5 flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 text-[13.5px] text-ink hover:bg-hover"
              >
                <input
                  type="checkbox"
                  checked={!hidden.has(f.value)}
                  onChange={() => onToggleFilter(f.value)}
                  className="size-4 rounded-[5px]"
                />
                <FilterSwatch kind={f.kind} />
                {f.label}
              </label>
            ))}
          </fieldset>
          {subjects.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <h2 className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Subjects</h2>
              {subjects.map((s) => (
                <Link
                  key={s.id}
                  href={`/subjects/${s.id}`}
                  className="-mx-1.5 flex h-8 min-w-0 items-center gap-2.5 rounded-lg px-1.5 text-[13.5px] text-ink outline-none hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
                >
                  <SubjectDot color={s.color} className="size-[9px]" />
                  <span className="truncate">{s.name}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1">
          {view === "agenda" ? (
            <div className="min-h-[540px] rounded-[20px] bg-raised px-5 py-4 shadow-[0_0_0_1px_var(--hairline)]">
              <AgendaList
                items={visibleItems}
                start={date}
                days={AGENDA_DAYS}
                onOpenItem={onOpenItem}
                onNew={onNew}
              />
            </div>
          ) : (
            <div className="h-[calc(100svh-168px)] min-h-[540px] overflow-hidden rounded-[20px] bg-raised shadow-[0_0_0_1px_var(--hairline)]">
              <div className="studi-calendar">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView={view}
                  initialDate={date}
                  headerToolbar={false}
                  firstDay={1}
                  height="100%"
                  expandRows={false}
                  scrollTime="07:30:00"
                  slotDuration="00:30:00"
                  slotLabelInterval="01:00"
                  slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                  eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                  allDayContent="all-day"
                  dayMaxEvents
                  eventDisplay="block"
                  selectable
                  selectMirror
                  unselectCancel=".studi-quick-create"
                  editable
                  eventStartEditable
                  eventDurationEditable
                  nowIndicator
                  events={events}
                  datesSet={datesSet}
                  select={select}
                  eventClick={eventClick}
                  eventDrop={onDrop}
                  eventResize={onResize}
                  dayHeaderContent={DayHeader}
                  dayCellContent={DayCell}
                  eventContent={EventContent}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function midpoint(range: Range) {
  return new Date((range.start.getTime() + range.end.getTime()) / 2);
}

function DayHeader(arg: DayHeaderContentArg) {
  const weekday = WEEKDAY.format(arg.date);
  if (arg.view.type === "dayGridMonth") {
    return <span className="block py-2.5 text-[12px] font-semibold text-ink-3">{weekday}</span>;
  }
  return (
    <span className="flex h-[54px] items-center justify-center gap-[7px]">
      <span className={cn("text-[12.5px] font-semibold", arg.isToday ? "text-accent-text" : "text-ink-3")}>
        {weekday}
      </span>
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums",
          arg.isToday
            ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
            : "text-ink",
        )}
      >
        {arg.date.getDate()}
      </span>
    </span>
  );
}

function DayCell(arg: DayCellContentArg) {
  if (!arg.view.type.startsWith("dayGrid")) return null;
  return (
    <span
      className={cn(
        "flex size-[26px] items-center justify-center rounded-full text-[12.5px] font-semibold tabular-nums",
        arg.isToday
          ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
          : "text-ink-2",
      )}
    >
      {arg.date.getDate()}
    </span>
  );
}

function EventContent(arg: EventContentArg) {
  const item = arg.event.extendedProps.item as CalItem | undefined;
  if (!item) {
    return <div className="studi-ev h-full rounded-[10px]" data-kind="session_planned" />;
  }
  const timed = !arg.event.allDay && arg.view.type !== "dayGridMonth";
  const start = arg.event.start;
  const end = arg.event.end;
  const range =
    start && end ? `${formatTime(start.toISOString())}–${formatTime(end.toISOString())}` : arg.timeText;
  return (
    <EventChip
      item={item}
      density={timed ? "grid" : "bar"}
      timeText={timed ? range : arg.event.allDay ? undefined : arg.timeText}
    />
  );
}
