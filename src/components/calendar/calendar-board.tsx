"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { toast } from "sonner";

import { moveAssessment } from "@/actions/assessments";
import { movePersonalEvent } from "@/actions/calendar-events";
import { moveStudySession } from "@/actions/study-sessions";
import {
  EventFormDialog,
  type CalendarDraft,
} from "@/components/calendar/event-form-dialog";
import { Button } from "@/components/ui/button";
import {
  ASSESSMENT_TYPE_META,
  subjectEventColor,
  toLocalDateInput,
  toLocalTimeInput,
  type CalendarView,
} from "@/lib/calendar";
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
  initialView?: CalendarView;
  initialDate?: string;
};

const VIEW_STORAGE_KEY = "studi-calendar-view";
const DATE_STORAGE_KEY = "studi-calendar-date";

const STORAGE_EVENT = "studi-calendar-storage";

function subscribeStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

function notifyStorage() {
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function readStoredView(fallback: CalendarView): CalendarView {
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  if (
    stored === "dayGridMonth" ||
    stored === "timeGridWeek" ||
    stored === "timeGridDay"
  ) {
    return stored;
  }
  return fallback;
}

function readStoredDate(fallback?: string) {
  return window.localStorage.getItem(DATE_STORAGE_KEY) ?? fallback;
}

export function CalendarBoard({
  assessments,
  personalEvents,
  studySessions,
  subjects,
  topics,
  tasks,
  initialView = "dayGridMonth",
  initialDate,
}: CalendarBoardProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const storedView = useSyncExternalStore(
    subscribeStorage,
    () => readStoredView(initialView),
    () => initialView,
  );
  const storedDate = useSyncExternalStore(
    subscribeStorage,
    () => readStoredDate(initialDate),
    () => initialDate,
  );

  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const view = storedView;

  const events = useMemo<EventInput[]>(() => {
    const assessmentEvents: EventInput[] = assessments.map((a) => {
      const subject = a.subject_id ? subjectMap.get(a.subject_id) : null;
      return {
        id: `assessment:${a.id}`,
        title: `${ASSESSMENT_TYPE_META[a.assessment_type].label}: ${a.title}`,
        start: a.starts_at,
        end: a.ends_at ?? undefined,
        allDay: a.all_day,
        backgroundColor: subjectEventColor(subject?.color),
        borderColor: subjectEventColor(subject?.color),
        editable: true,
        extendedProps: { kind: "assessment", record: a },
      };
    });

    const personal: EventInput[] = personalEvents.map((e) => ({
      id: `personal:${e.id}`,
      title: e.title,
      start: e.starts_at,
      end: e.ends_at ?? undefined,
      allDay: e.all_day,
      backgroundColor: "oklch(0.55 0.02 260)",
      borderColor: "oklch(0.55 0.02 260)",
      editable: true,
      extendedProps: { kind: "personal", record: e },
    }));

    const sessions: EventInput[] = studySessions.map((s) => {
      const subject = s.subject_id ? subjectMap.get(s.subject_id) : null;
      return {
        id: `study_session:${s.id}`,
        title: `Study${subject ? `: ${subject.name}` : ""}`,
        start: s.starts_at,
        end: s.ends_at,
        allDay: false,
        backgroundColor: subjectEventColor(subject?.color ?? "teal"),
        borderColor: subjectEventColor(subject?.color ?? "teal"),
        editable: true,
        extendedProps: { kind: "study_session", record: s },
      };
    });

    return [...assessmentEvents, ...personal, ...sessions];
  }, [assessments, personalEvents, studySessions, subjectMap]);

  const openCreate = useCallback((arg: DateSelectArg) => {
    const date = toLocalDateInput(arg.start.toISOString());
    const allDay = arg.allDay;
    setDraft({
      kind: "assessment",
      date,
      allDay,
      startTime: allDay ? undefined : toLocalTimeInput(arg.start.toISOString()),
      endTime: allDay
        ? undefined
        : arg.end
          ? toLocalTimeInput(arg.end.toISOString())
          : undefined,
    });
    setOpen(true);
  }, []);

  const openEdit = useCallback((arg: EventClickArg) => {
    const kind = arg.event.extendedProps.kind as CalendarDraft["kind"];
    const record = arg.event.extendedProps.record;
    if (kind === "assessment") {
      setDraft({
        kind,
        date: toLocalDateInput(record.starts_at),
        assessment: record,
      });
    } else if (kind === "personal") {
      setDraft({
        kind,
        date: toLocalDateInput(record.starts_at),
        personal: record,
      });
    } else if (kind === "study_session") {
      setDraft({
        kind,
        date: toLocalDateInput(record.starts_at),
        session: record,
      });
    }
    setOpen(true);
  }, []);

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
        }
        if (result?.error) {
          toast.error(result.error);
          revert();
        }
      });
    },
    [],
  );

  const onDrop = useCallback(
    (arg: EventDropArg) => {
      const start = arg.event.start;
      if (!start) {
        arg.revert();
        return;
      }
      persistMove(
        arg.event.id,
        start.toISOString(),
        arg.event.end?.toISOString() ?? null,
        arg.event.allDay,
        arg.revert,
      );
    },
    [persistMove],
  );

  const onResize = useCallback(
    (arg: EventResizeDoneArg) => {
      const start = arg.event.start;
      if (!start) {
        arg.revert();
        return;
      }
      persistMove(
        arg.event.id,
        start.toISOString(),
        arg.event.end?.toISOString() ?? null,
        arg.event.allDay,
        arg.revert,
      );
    },
    [persistMove],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => calendarRef.current?.getApi().today()}
        >
          Today
        </Button>
        {(
          [
            ["dayGridMonth", "Month"],
            ["timeGridWeek", "Week"],
            ["timeGridDay", "Day"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={view === value ? "default" : "outline"}
            onClick={() => {
              window.localStorage.setItem(VIEW_STORAGE_KEY, value);
              notifyStorage();
              calendarRef.current?.getApi().changeView(value);
            }}
          >
            {label}
          </Button>
        ))}
        {isPending ? (
          <span className="text-xs text-muted-foreground">Saving…</span>
        ) : null}
      </div>

      <div className="studi-panel overflow-hidden p-2 sm:p-4">
        <div className="studi-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={storedView}
            initialDate={storedDate}
            headerToolbar={{
              left: "prev,next",
              center: "title",
              right: "",
            }}
            height="auto"
            selectable
            selectMirror
            editable
            eventStartEditable
            eventDurationEditable
            nowIndicator
            dayMaxEvents
            events={events}
            select={openCreate}
            eventClick={openEdit}
            eventDrop={onDrop}
            eventResize={onResize}
            datesSet={(arg) => {
              const iso = arg.view.currentStart.toISOString();
              window.localStorage.setItem(DATE_STORAGE_KEY, iso);
              notifyStorage();
            }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click a slot to create. Drag to reschedule. Resize timed events in week
        or day view. Color follows the linked subject when available.
      </p>

      <EventFormDialog
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        subjects={subjects}
        topics={topics}
        tasks={tasks}
      />
    </div>
  );
}
