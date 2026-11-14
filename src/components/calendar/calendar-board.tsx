"use client";

import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Popover } from "@base-ui/react/popover";
import { toast } from "sonner";

import { moveAssessment } from "@/actions/assessments";
import { movePersonalEvent } from "@/actions/calendar-events";
import { moveStudySession } from "@/actions/study-sessions";
import { DesktopCalendar, type BoardView } from "@/components/calendar/desktop-calendar";
import {
  EventFormDialog,
  type CalendarDraft,
} from "@/components/calendar/event-form-dialog";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
import { MobileCalendar } from "@/components/calendar/mobile-calendar";
import { QuickCreateForm, type QuickDraft } from "@/components/calendar/quick-create";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { toLocalDateInput } from "@/lib/calendar";
import {
  buildCalendarItems,
  CAL_FILTERS,
  type CalFilter,
  type CalItem,
} from "@/lib/calendar-items";
import { startOfDay, toDateKey } from "@/lib/planning";
import type {
  Assessment,
  CalendarEvent,
  StudySession,
  Subject,
  Task,
  Topic,
} from "@/types/database";

type CalendarBoardProps = {
  assessments: Assessment[];
  personalEvents: CalendarEvent[];
  studySessions: StudySession[];
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
};

const VIEW_STORAGE_KEY = "studi-calendar-view";
const DATE_STORAGE_KEY = "studi-calendar-date";
const DAY_STORAGE_KEY = "studi-calendar-day";
const HIDDEN_STORAGE_KEY = "studi-calendar-hidden";
const MOBILE_AGENDA_KEY = "studi-calendar-mobile-agenda";

const VIEWS: BoardView[] = ["dayGridMonth", "timeGridWeek", "timeGridDay", "agenda"];

function readView(): BoardView {
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return VIEWS.includes(stored as BoardView) ? (stored as BoardView) : "dayGridMonth";
}

function readDate(key: string) {
  const stored = window.localStorage.getItem(key);
  const d = stored ? new Date(stored) : null;
  return d && !Number.isNaN(d.getTime()) ? d : startOfDay(new Date());
}

function readHidden() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_STORAGE_KEY) ?? "[]");
    const valid = CAL_FILTERS.map((f) => f.value);
    return new Set<CalFilter>(
      Array.isArray(parsed) ? parsed.filter((v): v is CalFilter => valid.includes(v)) : [],
    );
  } catch {
    return new Set<CalFilter>();
  }
}

const noopSubscribe = () => () => {};

export function CalendarBoard(props: CalendarBoardProps) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) return <CalendarSkeleton />;
  return <CalendarBoardClient {...props} />;
}

type QuickState = { draft: QuickDraft; anchor: DOMRect | null; key: number };

function CalendarBoardClient({
  assessments,
  personalEvents,
  studySessions,
  subjects,
  topics,
  tasks,
}: CalendarBoardProps) {
  const [view, setView] = useState<BoardView>(readView);
  const [date, setDate] = useState<Date>(() => readDate(DATE_STORAGE_KEY));
  const [day, setDay] = useState<Date>(() => startOfDay(readDate(DAY_STORAGE_KEY)));
  const [mobileAgenda, setMobileAgenda] = useState(
    () => window.localStorage.getItem(MOBILE_AGENDA_KEY) === "1",
  );
  const [hidden, setHidden] = useState<Set<CalFilter>>(readHidden);
  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [quick, setQuick] = useState<QuickState | null>(null);
  const [isPending, startTransition] = useTransition();

  const items = useMemo(
    () =>
      buildCalendarItems({
        assessments,
        personalEvents,
        studySessions,
        tasks,
        subjects,
        topicTitles: new Map(topics.map((t) => [t.id, t.title])),
      }),
    [assessments, personalEvents, studySessions, tasks, subjects, topics],
  );

  const changeView = useCallback((next: BoardView) => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    setView(next);
  }, []);

  const changeDate = useCallback((next: Date) => {
    window.localStorage.setItem(DATE_STORAGE_KEY, next.toISOString());
    setDate(next);
  }, []);

  const changeDay = useCallback((next: Date) => {
    window.localStorage.setItem(DAY_STORAGE_KEY, next.toISOString());
    setDay(startOfDay(next));
  }, []);

  const changeMobileAgenda = (next: boolean) => {
    window.localStorage.setItem(MOBILE_AGENDA_KEY, next ? "1" : "0");
    setMobileAgenda(next);
  };

  const toggleFilter = useCallback((filter: CalFilter) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const openItem = useCallback((item: CalItem) => {
    if (item.task) {
      setEditingTask(item.task);
      return;
    }
    const date = toLocalDateInput(item.start);
    if (item.assessment) setDraft({ kind: "assessment", date, assessment: item.assessment });
    else if (item.personal) setDraft({ kind: "personal", date, personal: item.personal });
    else if (item.session) setDraft({ kind: "study_session", date, session: item.session });
    setFormOpen(true);
  }, []);

  const openQuick = useCallback((next: QuickDraft, anchor: DOMRect | null) => {
    setQuick({ draft: next, anchor, key: Date.now() });
  }, []);

  const openNew = useCallback(() => {
    const base = view === "agenda" ? date : startOfDay(date);
    const today = startOfDay(new Date());
    const target = base.getTime() <= today.getTime() ? today : base;
    const hour = Math.min(22, new Date().getHours() + 1);
    openQuick(
      {
        date: toDateKey(target),
        allDay: false,
        startTime: `${String(hour).padStart(2, "0")}:00`,
        endTime: `${String(hour + 1).padStart(2, "0")}:00`,
      },
      null,
    );
  }, [date, openQuick, view]);

  const persistMove = useCallback(
    (
      eventId: string,
      starts_at: string,
      ends_at: string | null,
      all_day: boolean,
      revert: () => void,
    ) => {
      const [kind, id] = eventId.split(":");
      startTransition(async () => {
        let result;
        if (kind === "assessment") {
          result = await moveAssessment(id, { starts_at, ends_at, all_day });
        } else if (kind === "personal") {
          result = await movePersonalEvent(id, { starts_at, ends_at, all_day });
        } else if (kind === "study_session") {
          result = await moveStudySession(id, { starts_at, ends_at });
        } else {
          revert();
          return;
        }
        if (result?.error) {
          toast.error(result.error);
          revert();
        }
      });
    },
    [],
  );

  const closeQuick = () => setQuick(null);
  const moreOptions = (next: CalendarDraft) => {
    setQuick(null);
    setDraft(next);
    setFormOpen(true);
  };

  const anchor = useMemo(() => {
    const rect = quick?.anchor;
    return rect ? { getBoundingClientRect: () => rect } : null;
  }, [quick]);

  const quickForm = quick ? (
    <QuickCreateForm
      key={quick.key}
      draft={quick.draft}
      subjects={subjects}
      topics={topics}
      onDone={closeQuick}
      onMoreOptions={moreOptions}
    />
  ) : null;

  return (
    <>
      <DesktopCalendar
        className="hidden md:flex"
        items={items}
        subjects={subjects}
        view={view}
        onViewChange={changeView}
        date={date}
        onDateChange={changeDate}
        hidden={hidden}
        onToggleFilter={toggleFilter}
        onSelectRange={openQuick}
        onOpenItem={openItem}
        onMove={persistMove}
        onNew={openNew}
        selectionOpen={Boolean(quick?.anchor)}
        pending={isPending}
      />
      <MobileCalendar
        className="flex md:hidden"
        items={items}
        day={day}
        onDayChange={changeDay}
        agenda={mobileAgenda}
        onAgendaChange={changeMobileAgenda}
        hidden={hidden}
        onToggleFilter={toggleFilter}
        onCreate={(next) => openQuick(next, null)}
        onOpenItem={openItem}
      />

      <Popover.Root
        open={Boolean(quick?.anchor)}
        onOpenChange={(open) => {
          if (!open) closeQuick();
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchor}
            side="right"
            align="start"
            sideOffset={8}
            collisionPadding={16}
            className="z-50"
          >
            <Popover.Popup className="studi-quick-create w-[320px] rounded-[20px] bg-raised p-4 text-ink shadow-[var(--shadow-pop),0_0_0_1px_var(--hairline)] outline-none transition-[opacity,scale] duration-150 ease-studi data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <Popover.Title className="sr-only">New calendar entry</Popover.Title>
              {quick?.anchor ? quickForm : null}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <ResponsiveDialog
        open={Boolean(quick && !quick.anchor)}
        onOpenChange={(open) => {
          if (!open) closeQuick();
        }}
        title="New calendar entry"
        className="md:w-[min(440px,calc(100vw-48px))]"
      >
        {quick && !quick.anchor ? quickForm : null}
      </ResponsiveDialog>

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        draft={draft}
        subjects={subjects}
        topics={topics}
        tasks={tasks}
      />
      <TaskFormDialog
        open={editingTask !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
        subjects={subjects}
        topics={topics}
      />
    </>
  );
}
