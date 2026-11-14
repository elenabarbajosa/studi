"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Play, Plus } from "lucide-react";
import { toast } from "sonner";

import { setTaskStatus } from "@/actions/tasks";
import { useOpenNewTask } from "@/components/dashboard/new-task-provider";
import { Tile, TileHeader, tileLinkClass } from "@/components/dashboard/tile";
import type { PriorityLevel } from "@/lib/calendar";
import { PRIORITY_MARK } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type TodayTaskRow = {
  id: string;
  title: string;
  priority: PriorityLevel;
  subjectName: string | null;
  subjectDot: string | null;
  overdueLabel: string | null;
};

const PRIORITY_TEXT: Record<PriorityLevel, string> = {
  critical: "text-danger",
  high: "text-warning",
  medium: "text-ink-3",
  low: "text-ink-3",
};

function useTaskCompletion() {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();

  const mark = (id: string, value: boolean) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggle = (row: TodayTaskRow) => {
    const completing = !done.has(row.id);
    mark(row.id, completing);
    startTransition(async () => {
      const result = await setTaskStatus(row.id, completing ? "completed" : "todo");
      if (result.error) {
        mark(row.id, !completing);
        toast.error(result.error);
        return;
      }
      if (completing) {
        toast.success("Task completed", {
          description: row.title,
          action: {
            label: "Undo",
            onClick: () => {
              mark(row.id, false);
              startTransition(async () => {
                const undo = await setTaskStatus(row.id, "todo");
                if (undo.error) toast.error(undo.error);
              });
            },
          },
        });
      }
    });
  };

  return { done, toggle };
}

function TaskCheckbox({
  row,
  checked,
  onToggle,
  size,
}: {
  row: TodayTaskRow;
  checked: boolean;
  onToggle: () => void;
  size: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Complete “${row.title}”`}
      onClick={onToggle}
      className="group/check -m-2.5 flex size-[42px] shrink-0 items-center justify-center rounded-full outline-none"
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-[1.8px] transition-colors duration-200 group-focus-visible/check:ring-2 group-focus-visible/check:ring-ring group-focus-visible/check:ring-offset-2 group-focus-visible/check:ring-offset-raised",
          size === "md" ? "size-[22px]" : "size-5",
          checked
            ? "border-primary bg-primary text-primary-foreground dark:border-accent dark:bg-accent dark:text-ink-on-accent"
            : "border-ink-4 group-hover/check:border-ink-3",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
      </span>
    </button>
  );
}

function TaskMeta({ row }: { row: TodayTaskRow }) {
  const mark = PRIORITY_MARK[row.priority];
  return (
    <>
      {row.overdueLabel ? (
        <span className="shrink-0 text-xs font-semibold text-danger">
          {row.overdueLabel}
        </span>
      ) : null}
      {mark ? (
        <span
          className={cn("shrink-0 text-xs font-bold", PRIORITY_TEXT[row.priority])}
          title={`${row.priority} priority`}
        >
          {mark}
          <span className="sr-only"> {row.priority} priority</span>
        </span>
      ) : null}
      {row.subjectDot ? (
        <span
          className="size-[9px] shrink-0 rounded-full"
          style={{ background: row.subjectDot }}
          title={row.subjectName ?? undefined}
        >
          <span className="sr-only">{row.subjectName}</span>
        </span>
      ) : null}
    </>
  );
}

function EmptyToday({ compact }: { compact?: boolean }) {
  const openNewTask = useOpenNewTask();
  return (
    <div className={cn("flex flex-col gap-1", compact ? "py-4" : "py-[18px]")}>
      <p className="text-[15px] font-semibold text-ink">Nothing due today</p>
      <p className="text-[13.5px] leading-snug text-ink-2">
        Add a task, or plan a study block for an upcoming exam.
      </p>
      <button
        type="button"
        onClick={openNewTask}
        className="mt-2.5 inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13.5px] font-medium text-ink outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-[15px]" aria-hidden />
        New task
      </button>
    </div>
  );
}

const MAX_ROWS = 6;

export function TodayTasksTile({ rows }: { rows: TodayTaskRow[] }) {
  const { done, toggle } = useTaskCompletion();
  const open = rows.length - rows.filter((r) => done.has(r.id)).length;
  const visible = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <Tile
      aria-labelledby="today-title"
      className="flex flex-[5_1_320px] flex-col px-[22px] py-5"
    >
      <TileHeader
        id="today-title"
        title="Today"
        className="pb-2"
        action={
          <Link href="/tasks?view=today" className={tileLinkClass}>
            {rows.length === 0 ? "All tasks" : `${open} open`}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyToday />
      ) : (
        <ul>
          {visible.map((row) => {
            const checked = done.has(row.id);
            return (
              <li
                key={row.id}
                className="flex min-h-11 items-center gap-[11px] border-b border-hairline last:border-b-0"
              >
                <TaskCheckbox row={row} checked={checked} onToggle={() => toggle(row)} size="md" />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[14.5px] transition-colors duration-200",
                    checked ? "text-ink-3 line-through" : "text-ink",
                  )}
                >
                  {row.title}
                </span>
                <TaskMeta row={row} />
                <Link
                  href="/focus"
                  title="Start focus"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Play className="size-[13px]" aria-hidden />
                  <span className="sr-only">Start focus</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 ? (
        <Link href="/tasks?view=today" className={cn(tileLinkClass, "mt-3 w-fit")}>
          {hidden} more in Tasks
        </Link>
      ) : null}
    </Tile>
  );
}

export function MobileTodayTasks({ rows }: { rows: TodayTaskRow[] }) {
  const { done, toggle } = useTaskCompletion();
  const visible = rows.slice(0, 5);
  const hidden = rows.length - visible.length;

  return (
    <section
      aria-labelledby="today-title-mobile"
      className="rounded-[22px] bg-raised px-4 py-1.5 shadow-[0_0_0_1px_var(--hairline)]"
    >
      <h2 id="today-title-mobile" className="sr-only">
        Today’s tasks
      </h2>
      {rows.length === 0 ? (
        <EmptyToday compact />
      ) : (
        <ul>
          {visible.map((row) => {
            const checked = done.has(row.id);
            return (
              <li
                key={row.id}
                className="flex h-[50px] items-center gap-3 border-b border-sunken last:border-b-0"
              >
                <TaskCheckbox row={row} checked={checked} onToggle={() => toggle(row)} size="md" />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[15px]",
                    checked ? "text-ink-3 line-through" : "text-ink",
                  )}
                >
                  {row.title}
                </span>
                <TaskMeta row={row} />
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 0 ? (
        <Link
          href="/tasks?view=today"
          className="flex h-11 items-center justify-between border-t border-sunken text-[13.5px] font-medium text-accent-text outline-none focus-visible:underline"
        >
          {hidden > 0 ? `${hidden} more in Tasks` : "All tasks"}
          <span aria-hidden>›</span>
        </Link>
      ) : null}
    </section>
  );
}
