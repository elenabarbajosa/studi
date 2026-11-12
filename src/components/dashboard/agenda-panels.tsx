import Link from "next/link";
import { CalendarDays, CheckSquare, Clock3, TriangleAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  ASSESSMENT_TYPE_META,
  examCountdown,
  toLocalDateInput,
  toLocalTimeInput,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type {
  Assessment,
  CalendarEvent,
  StudySession,
  Subject,
  Task,
} from "@/types/database";

type AgendaPanelsProps = {
  todayTasks: Task[];
  overdueTasks: Task[];
  upcomingAssessments: Assessment[];
  upcomingSessions: StudySession[];
  weekAssessments: Assessment[];
  weekSessions: StudySession[];
  weekEvents: CalendarEvent[];
  subjects: Subject[];
};

export function AgendaPanels({
  todayTasks,
  overdueTasks,
  upcomingAssessments,
  upcomingSessions,
  weekAssessments,
  weekSessions,
  weekEvents,
  subjects,
}: AgendaPanelsProps) {
  const subjectName = (id: string | null) =>
    id ? subjects.find((s) => s.id === id)?.name : null;

  const weekItems = [
    ...weekAssessments.map((a) => ({
      id: a.id,
      when: a.starts_at,
      title: a.title,
      meta: ASSESSMENT_TYPE_META[a.assessment_type].label,
      allDay: a.all_day,
    })),
    ...weekSessions.map((s) => ({
      id: s.id,
      when: s.starts_at,
      title: `Study${subjectName(s.subject_id) ? `: ${subjectName(s.subject_id)}` : ""}`,
      meta: "Study session",
      allDay: false,
    })),
    ...weekEvents.map((e) => ({
      id: e.id,
      when: e.starts_at,
      title: e.title,
      meta: "Personal",
      allDay: e.all_day,
    })),
  ].sort(
    (a, b) => new Date(a.when).getTime() - new Date(b.when).getTime(),
  );

  return (
    <div className="mb-10 grid gap-4 lg:grid-cols-2">
      <section className="studi-panel p-5">
        <Header
          icon={CheckSquare}
          title="Today’s tasks"
          href="/tasks?view=today"
          linkLabel="All tasks"
        />
        {todayTasks.length === 0 ? (
          <Empty copy="Nothing due today." />
        ) : (
          <ul className="mt-4 space-y-2">
            {todayTasks.map((t) => (
              <li key={t.id} className="text-sm">
                <span className="font-medium">{t.title}</span>
                {subjectName(t.subject_id) ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {subjectName(t.subject_id)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {overdueTasks.length > 0 ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-destructive">
              <TriangleAlert className="size-3.5" />
              Overdue ({overdueTasks.length})
            </p>
            <ul className="space-y-1">
              {overdueTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="text-sm text-muted-foreground">
                  {t.title}
                  {t.due_at ? ` · ${toLocalDateInput(t.due_at)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="studi-panel p-5">
        <Header
          icon={Clock3}
          title="Upcoming exams"
          href="/calendar"
          linkLabel="Calendar"
        />
        {upcomingAssessments.length === 0 ? (
          <Empty copy="No upcoming assessments." />
        ) : (
          <ul className="mt-4 space-y-3">
            {upcomingAssessments.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ASSESSMENT_TYPE_META[a.assessment_type].label}
                    {subjectName(a.subject_id)
                      ? ` · ${subjectName(a.subject_id)}`
                      : ""}
                    {" · "}
                    {toLocalDateInput(a.starts_at)}
                    {a.all_day ? "" : ` ${toLocalTimeInput(a.starts_at)}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-primary">
                  {examCountdown(a.starts_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="studi-panel p-5">
        <Header
          icon={CalendarDays}
          title="This week"
          href="/calendar"
          linkLabel="Open calendar"
        />
        {weekItems.length === 0 ? (
          <Empty copy="No events scheduled this week." />
        ) : (
          <ul className="mt-4 space-y-2">
            {weekItems.slice(0, 8).map((item) => (
              <li key={`${item.meta}-${item.id}`} className="text-sm">
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {item.meta} · {toLocalDateInput(item.when)}
                  {item.allDay ? "" : ` ${toLocalTimeInput(item.when)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="studi-panel p-5">
        <Header
          icon={Clock3}
          title="Upcoming study sessions"
          href="/calendar"
          linkLabel="Schedule"
        />
        {upcomingSessions.length === 0 ? (
          <Empty copy="No planned study sessions ahead." />
        ) : (
          <ul className="mt-4 space-y-2">
            {upcomingSessions.map((s) => (
              <li key={s.id} className="text-sm">
                <span className="font-medium">
                  {subjectName(s.subject_id) ?? "Study session"}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {toLocalDateInput(s.starts_at)}{" "}
                  {toLocalTimeInput(s.starts_at)}–
                  {s.ends_at ? toLocalTimeInput(s.ends_at) : "—"} ·{" "}
                  {s.planned_duration_minutes}
                  m
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Header({
  icon: Icon,
  title,
  href,
  linkLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" aria-hidden />
        <h2 className="font-display text-xl tracking-tight">{title}</h2>
      </div>
      <Link
        href={href}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        {linkLabel}
      </Link>
    </div>
  );
}

function Empty({ copy }: { copy: string }) {
  return <p className="mt-4 text-sm text-muted-foreground">{copy}</p>;
}
