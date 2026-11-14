"use client";

import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  ListTree,
  MoreHorizontal,
  Paperclip,
  Play,
} from "lucide-react";

import { DifficultyBars, SegmentBar } from "@/components/studi/progress-bits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { subjectTone, subjectToneVars } from "@/lib/subjects";
import type { Subject } from "@/types/database";

export type SubjectTileData = {
  subject: Subject;
  topicCount: number;
  masteredCount: number;
  nextAssessment: { title: string; days: number } | null;
};

function countdown(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `${days}d`;
}

/** Tinted tile: identity, difficulty, one segment per root topic, next exam. */
export function SubjectCard({
  subject,
  topicCount,
  masteredCount,
  nextAssessment,
}: SubjectTileData) {
  const tone = subjectTone(subject.color);
  const href = `/subjects/${subject.id}`;

  return (
    <article
      className="subject-tone group/tile relative flex min-h-[164px] min-w-0 md:min-h-[190px] flex-col gap-3 rounded-[24px] px-5 pt-[18px] pb-[18px] transition-transform duration-200 ease-studi focus-within:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
      style={subjectToneVars(subject.color) as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <span aria-hidden className="size-3 rounded-full" style={{ background: tone.dot }} />
        <div className="flex items-center gap-2">
          <DifficultyBars value={subject.difficulty} color={tone.dot} />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="relative z-10 -mr-2 flex size-8 items-center justify-center rounded-full text-current outline-none transition-colors hover:bg-raised/70 focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] data-popup-open:bg-raised/70 dark:hover:bg-white/10"
              aria-label={`Quick actions for ${subject.name}`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem render={<Link href={href} />}>
                <BookOpen aria-hidden />
                Open subject
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`${href}?tab=topics`} />}>
                <ListTree aria-hidden />
                Topics
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`${href}?tab=materials`} />}>
                <Paperclip aria-hidden />
                Materials
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`${href}?tab=exams`} />}>
                <GraduationCap aria-hidden />
                Exams & deadlines
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={<Link href={`/focus?subject=${subject.id}`} />}
              >
                <Play aria-hidden />
                Start focus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="line-clamp-2 text-[18px] leading-tight font-semibold tracking-[-0.02em] break-words text-ink">
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:rounded-[24px] after:content-['']"
          >
            {subject.name}
          </Link>
        </h2>
        {subject.description ? <p className="line-clamp-1 text-[13px]">{subject.description}</p> : null}
      </div>

      <div className="mt-auto flex flex-col gap-1.5">
        <SegmentBar
          total={topicCount}
          filled={masteredCount}
          color={tone.dot}
          trackClassName="bg-raised/85 dark:bg-white/12"
        />
        <div className="flex items-baseline justify-between gap-2 text-[12.5px] font-medium">
          <span className="min-w-0 truncate">
            {topicCount === 0 ? "No topics yet" : `${masteredCount} of ${topicCount} topics mastered`}
          </span>
          <span className="max-w-[55%] shrink-0 truncate font-semibold">
            {nextAssessment
              ? `${nextAssessment.title} · ${countdown(nextAssessment.days)}`
              : "No exams yet"}
          </span>
        </div>
      </div>
    </article>
  );
}
