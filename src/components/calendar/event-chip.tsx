import {
  CircleCheck,
  Flag,
  GraduationCap,
  Timer,
  User,
  type LucideIcon,
} from "lucide-react";

import type { CalItem, CalItemKind } from "@/lib/calendar-items";
import { subjectToneVars } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export const KIND_ICON: Record<CalItemKind, LucideIcon> = {
  exam: GraduationCap,
  deadline: Flag,
  session_done: Timer,
  session_planned: Timer,
  session_other: Timer,
  task: CircleCheck,
  personal: User,
};

const KIND_LABEL: Record<CalItemKind, string> = {
  exam: "Exam",
  deadline: "Deadline",
  session_done: "Study session",
  session_planned: "Planned study session",
  session_other: "Study session (not done)",
  task: "Task due",
  personal: "Personal event",
};

export function kindLabel(kind: CalItemKind) {
  return KIND_LABEL[kind];
}

export function eventToneStyle(item: Pick<CalItem, "color">) {
  return item.color ? (subjectToneVars(item.color) as React.CSSProperties) : undefined;
}

/**
 * The single visual for a calendar entry. Kind drives the treatment
 * (solid, dashed, tinted, dark); subject drives the colour.
 */
export function EventChip({
  item,
  timeText,
  density,
  className,
}: {
  item: CalItem;
  timeText?: string;
  density: "grid" | "bar" | "card";
  className?: string;
}) {
  const Icon = KIND_ICON[item.kind];
  return (
    <div
      data-kind={item.kind}
      style={eventToneStyle(item)}
      className={cn(
        "studi-ev flex h-full min-w-0 overflow-hidden",
        density === "bar" && "h-[24px] items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-semibold",
        density === "grid" && "flex-col gap-px rounded-[10px] px-2 py-[5px] leading-[1.25]",
        density === "card" && "items-start gap-2 rounded-[14px] px-3 py-[7px] leading-[1.3]",
        className,
      )}
    >
      <span className="sr-only">{kindLabel(item.kind)}: </span>
      {density === "bar" ? (
        <>
          <Icon className="size-3 shrink-0" aria-hidden />
          {timeText ? <span className="shrink-0 font-medium tabular-nums opacity-90">{timeText}</span> : null}
          <span className="min-w-0 truncate">{item.title}</span>
        </>
      ) : density === "grid" ? (
        <>
          <span className="flex min-w-0 items-center gap-[5px] text-[12.5px] font-semibold">
            <Icon className="size-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{item.title}</span>
          </span>
          {timeText ? (
            <span className="truncate text-[11.5px] tabular-nums opacity-90">{timeText}</span>
          ) : null}
          {item.meta ? (
            <span className="truncate text-[11.5px] opacity-80">{item.meta}</span>
          ) : null}
        </>
      ) : (
        <>
          <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-semibold">{item.title}</span>
            <span className="truncate text-[12px] tabular-nums opacity-90">
              {[timeText, item.meta].filter(Boolean).join(" · ")}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
