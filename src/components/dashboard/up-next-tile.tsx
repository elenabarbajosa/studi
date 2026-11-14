import Link from "next/link";
import { Play } from "lucide-react";

import { ProgressRing } from "@/components/dashboard/progress-ring";
import { Tile } from "@/components/dashboard/tile";

export type UpNextContent = {
  label: string;
  title: string;
  meta: string | null;
};

type UpNextTileProps = {
  content: UpNextContent;
  focusMinutes: number;
  breakMinutes: number;
};

/** The dial scale tops out at 90 minutes, the longest focus preset. */
const DIAL_MAX_MINUTES = 90;

const startButtonClass =
  "inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[14.5px] font-semibold text-primary-foreground shadow-[0_10px_22px_-10px_var(--primary)] outline-none transition-[filter] hover:brightness-[.92] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-accent-soft dark:bg-accent dark:text-ink-on-accent dark:shadow-none";

export function UpNextTile({ content, focusMinutes, breakMinutes }: UpNextTileProps) {
  return (
    <Tile
      variant="hero"
      aria-labelledby="up-next-title"
      className="flex flex-[7_1_480px] flex-wrap items-center gap-6 px-[26px] py-6"
    >
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2.5">
        <p className="type-overline text-accent-text">{content.label}</p>
        <h2
          id="up-next-title"
          className="text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] text-pretty text-ink"
        >
          {content.title}
        </h2>
        {content.meta ? (
          <p className="text-[14.5px] leading-normal text-ink-2">{content.meta}</p>
        ) : null}
      </div>
      <ProgressRing
        size={200}
        radius={88}
        stroke={10}
        value={focusMinutes / DIAL_MAX_MINUTES}
        trackClassName="stroke-canvas/60"
        className="mx-auto"
      >
        <span className="text-[44px] leading-none font-semibold tracking-[-0.04em] text-ink tabular-nums">
          {focusMinutes}m
        </span>
        <span className="mt-2 text-[13px] font-medium text-ink-2 tabular-nums">
          {breakMinutes > 0 ? `${breakMinutes}m break` : "No break"}
        </span>
        <Link href="/focus" className={`${startButtonClass} mt-3`}>
          <Play className="size-3.5 fill-current" aria-hidden />
          Start
          <span className="sr-only"> a {focusMinutes}-minute focus session</span>
        </Link>
      </ProgressRing>
    </Tile>
  );
}

export function MobileUpNextTile({ content, focusMinutes }: UpNextTileProps) {
  return (
    <Tile
      variant="hero"
      aria-labelledby="up-next-title-mobile"
      className="flex items-center gap-3.5 rounded-[24px] p-[18px]"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-xs font-semibold tracking-[0.05em] text-accent-text uppercase">
          {content.label}
        </p>
        <h2
          id="up-next-title-mobile"
          className="text-lg leading-[1.2] font-semibold tracking-[-0.02em] text-ink"
        >
          {content.title}
        </h2>
        {content.meta ? (
          <p className="text-[13px] leading-snug text-ink-2">{content.meta}</p>
        ) : null}
      </div>
      <ProgressRing
        size={104}
        radius={45}
        stroke={7}
        value={focusMinutes / DIAL_MAX_MINUTES}
        trackClassName="stroke-canvas/60"
      >
        <Link
          href="/focus"
          className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-accent-soft active:scale-95 dark:bg-accent dark:text-ink-on-accent"
        >
          <Play className="ml-[3px] size-[22px] fill-current" aria-hidden />
          <span className="sr-only">Start a {focusMinutes}-minute focus session</span>
        </Link>
      </ProgressRing>
    </Tile>
  );
}
