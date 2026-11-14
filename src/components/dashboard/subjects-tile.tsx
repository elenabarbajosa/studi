import Link from "next/link";
import { useId } from "react";
import { Plus } from "lucide-react";

import { Tile, TileHeader, tileLinkClass } from "@/components/dashboard/tile";
import { SegmentBar } from "@/components/studi/progress-bits";
import { subjectTone, type SubjectColor } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export type SubjectRow = {
  id: string;
  name: string;
  color: SubjectColor;
  topicCount: number;
  masteredCount: number;
};

const MAX_ROWS = 5;

const BAR_WIDTH = "w-[clamp(64px,28%,128px)] shrink-0";

export function SubjectsTile({ rows }: { rows: SubjectRow[] }) {
  const titleId = useId();
  const visible = rows.slice(0, MAX_ROWS);

  return (
    <Tile
      aria-labelledby={titleId}
      className="flex flex-[5_1_320px] flex-col gap-2 px-[22px] py-5"
    >
      <TileHeader
        id={titleId}
        title="Subjects"
        action={
          <Link href="/subjects" className={tileLinkClass}>
            {rows.length === 0 ? "Open" : "Manage"}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <div className="flex flex-col gap-1 py-3">
          <p className="text-[15px] font-semibold text-ink">No subjects yet</p>
          <p className="text-[13.5px] leading-snug text-ink-2">
            Create a subject to organize topics, materials and exams.
          </p>
          <Link
            href="/subjects"
            className="mt-2.5 inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13.5px] font-medium text-ink outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-[15px]" aria-hidden />
            Add a subject
          </Link>
        </div>
      ) : (
        <ul>
          {visible.map((row) => (
            <li key={row.id} className="border-b border-hairline last:border-b-0">
              <Link
                href={`/subjects/${row.id}`}
                className="-mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 outline-none transition-colors hover:bg-sunken focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className="size-[9px] shrink-0 rounded-full"
                  style={{ background: subjectTone(row.color).dot }}
                />
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                  {row.name}
                </span>
                <SegmentBar
                  total={row.topicCount}
                  filled={row.masteredCount}
                  color={subjectTone(row.color).dot}
                  className={BAR_WIDTH}
                />
                <span className="w-16 shrink-0 text-right text-[12.5px] text-ink-2 tabular-nums">
                  {row.topicCount === 0
                    ? "No topics"
                    : `${row.masteredCount}/${row.topicCount}`}
                  <span className="sr-only">
                    {row.topicCount === 0 ? "" : " topics mastered"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length > visible.length ? (
        <Link href="/subjects" className={cn(tileLinkClass, "w-fit")}>
          {rows.length - visible.length} more{" "}
          {rows.length - visible.length === 1 ? "subject" : "subjects"}
        </Link>
      ) : null}
    </Tile>
  );
}
