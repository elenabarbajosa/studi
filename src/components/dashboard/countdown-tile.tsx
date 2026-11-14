import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { Tile, TileHeader, tileLinkClass } from "@/components/dashboard/tile";
import { subjectToneVars, type SubjectColor } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export type CountdownItem = {
  id: string;
  title: string;
  typeLabel: string;
  subjectName: string | null;
  subjectColor: SubjectColor | null;
  days: number;
  weekday: string;
  href: string;
};

function toneProps(color: SubjectColor | null) {
  return color
    ? { className: "subject-tone", style: subjectToneVars(color) as React.CSSProperties }
    : { className: "bg-sunken text-ink-2", style: undefined };
}

function daysText(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function CountdownTile({ items }: { items: CountdownItem[] }) {
  return (
    <Tile
      aria-labelledby="countdown-title"
      className="flex flex-[4_1_280px] flex-col gap-2.5 px-[22px] py-5"
    >
      <TileHeader
        id="countdown-title"
        title="Countdown"
        action={
          <Link href="/calendar" className={tileLinkClass}>
            Calendar
          </Link>
        }
      />
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-1 py-4">
          <p className="text-[15px] font-semibold text-ink">No exams ahead</p>
          <p className="text-[13.5px] leading-snug text-ink-2">
            Add exams and deadlines to a subject and they’ll count down here.
          </p>
          <Link href="/subjects" className={cn(tileLinkClass, "mt-2 w-fit")}>
            Go to Subjects
          </Link>
        </div>
      ) : (
        <ul className="grid flex-1 auto-rows-fr grid-cols-2 gap-2">
          {items.slice(0, 4).map((item) => {
            const tone = toneProps(item.subjectColor);
            return (
              <li key={item.id} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-full min-h-[96px] min-w-0 flex-col justify-between gap-2.5 rounded-2xl px-3.5 py-3 outline-none transition-[filter] hover:brightness-[.97] focus-visible:ring-2 focus-visible:ring-ring dark:hover:brightness-110",
                    tone.className,
                  )}
                  style={tone.style}
                >
                  <span className="text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                    {item.days <= 0 ? (
                      "Today"
                    ) : (
                      <>
                        {item.days}
                        <span className="text-[13px]"> d</span>
                      </>
                    )}
                    <span className="sr-only"> ({daysText(item.days)})</span>
                  </span>
                  <span className="flex min-w-0 flex-col leading-[1.3]">
                    <span className="truncate text-[13.5px] font-semibold text-ink">
                      {item.title}
                    </span>
                    <span className="truncate text-xs">
                      {item.typeLabel}
                      {item.subjectName ? ` · ${item.subjectName}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}

export function MobileNextExamTile({ item }: { item: CountdownItem | null }) {
  if (!item) {
    return (
      <Link
        href="/subjects"
        className="flex min-w-0 flex-col justify-between gap-2 rounded-[22px] bg-sunken p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GraduationCap className="size-5 text-ink-3" aria-hidden />
        <span className="text-[15px] leading-snug font-semibold text-ink">
          No exams ahead
        </span>
        <span className="text-[12.5px] text-ink-2">Add one in Subjects</span>
      </Link>
    );
  }

  const tone = toneProps(item.subjectColor);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-w-0 flex-col justify-between gap-1 rounded-[22px] p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone.className,
      )}
      style={tone.style}
    >
      <span className="truncate text-[12.5px]">{item.title}</span>
      <span className="text-[40px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
        {item.days <= 0 ? (
          <span className="text-[28px]">Today</span>
        ) : (
          <>
            {item.days}
            <span className="text-[15px]">
              {item.days === 1 ? " day" : " days"}
            </span>
          </>
        )}
      </span>
      <span className="truncate text-[12.5px]">
        {item.subjectName ?? item.typeLabel} · {item.weekday}
      </span>
    </Link>
  );
}
