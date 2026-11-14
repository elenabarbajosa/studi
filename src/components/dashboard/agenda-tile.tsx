import Link from "next/link";
import { useId } from "react";
import { CalendarDays, GraduationCap, Timer } from "lucide-react";

import { Tile, TileHeader, tileLinkClass } from "@/components/dashboard/tile";
import { cn } from "@/lib/utils";

export type AgendaKind = "assessment" | "session" | "event";

export type AgendaItem = {
  id: string;
  kind: AgendaKind;
  title: string;
  meta: string;
  dayLabel: string;
  timeLabel: string;
  subjectDot: string | null;
};

const KIND_ICON = {
  assessment: GraduationCap,
  session: Timer,
  event: CalendarDays,
} as const;

const KIND_LABEL: Record<AgendaKind, string> = {
  assessment: "Exam or deadline",
  session: "Study session",
  event: "Personal event",
};

const MAX_ITEMS = 7;

export function AgendaTile({ items }: { items: AgendaItem[] }) {
  const titleId = useId();
  const visible = items.slice(0, MAX_ITEMS);
  const groups = visible.reduce<{ day: string; items: AgendaItem[] }[]>((acc, item) => {
    const last = acc.at(-1);
    if (last && last.day === item.dayLabel) last.items.push(item);
    else acc.push({ day: item.dayLabel, items: [item] });
    return acc;
  }, []);

  return (
    <Tile
      aria-labelledby={titleId}
      className="flex flex-[7_1_420px] flex-col gap-2 px-[22px] py-5"
    >
      <TileHeader
        id={titleId}
        title="This week"
        action={
          <Link href="/calendar" className={tileLinkClass}>
            Open calendar
          </Link>
        }
      />
      {groups.length === 0 ? (
        <div className="flex flex-col gap-1 py-3">
          <p className="text-[15px] font-semibold text-ink">A clear week</p>
          <p className="text-[13.5px] leading-snug text-ink-2">
            No exams, study sessions or events in the next seven days.
          </p>
          <Link href="/calendar" className={cn(tileLinkClass, "mt-2 w-fit")}>
            Plan a study session
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.day} className="flex flex-col">
              <h3 className="pb-1 text-xs font-semibold text-ink-3">{group.day}</h3>
              <ul>
                {group.items.map((item) => {
                  const Icon = KIND_ICON[item.kind];
                  return (
                    <li
                      key={`${item.kind}-${item.id}`}
                      className="flex min-h-11 items-center gap-3 border-b border-hairline last:border-b-0"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-[10px]",
                          item.kind === "assessment"
                            ? "bg-ink text-canvas"
                            : "bg-sunken text-ink-2",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        <span className="sr-only">{KIND_LABEL[item.kind]}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[14.5px] text-ink">{item.title}</span>
                        <span className="truncate text-[12.5px] text-ink-2">{item.meta}</span>
                      </span>
                      {item.subjectDot ? (
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: item.subjectDot }}
                        />
                      ) : null}
                      <span className="w-14 shrink-0 text-right text-[13px] text-ink-2 tabular-nums">
                        {item.timeLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {items.length > visible.length ? (
            <Link href="/calendar" className={cn(tileLinkClass, "w-fit")}>
              {items.length - visible.length} more in Calendar
            </Link>
          ) : null}
        </div>
      )}
    </Tile>
  );
}
