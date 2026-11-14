import Link from "next/link";

import { Tile, TileHeader, tileLinkClass } from "@/components/dashboard/tile";
import { cn } from "@/lib/utils";

export function RhythmSummary({
  mode,
  focusMinutes,
  shortBreakMinutes,
  longBreakMinutes,
  intervalsBeforeLong,
  autoStartBreaks,
  className,
}: {
  mode: "pomodoro" | "stopwatch";
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  intervalsBeforeLong: number;
  autoStartBreaks: boolean;
  className?: string;
}) {
  return (
    <Tile variant="data" className={cn("p-4 md:p-5", className)}>
      <TileHeader
        title="Rhythm"
        action={
          <Link href="/settings/focus" className={tileLinkClass}>
            Change in Settings
          </Link>
        }
      />
      {mode === "pomodoro" ? (
        <>
          <dl className="mt-3 flex flex-wrap gap-2">
            <RhythmPill label="Focus" value={`${focusMinutes}m`} />
            <RhythmPill label="Break" value={`${shortBreakMinutes}m`} />
            <RhythmPill label="Long" value={`${longBreakMinutes}m`} />
            <RhythmPill label="Every" value={`${intervalsBeforeLong}`} />
          </dl>
          {autoStartBreaks ? (
            <p className="mt-2.5 text-[12.5px] text-ink-3">Breaks start automatically.</p>
          ) : (
            <p className="mt-2.5 text-[12.5px] text-ink-3">
              Temporary focus length stays on this page until you start.
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-[13.5px] text-ink-2">
          The stopwatch counts up until you finish. Pauses aren’t counted.
        </p>
      )}
    </Tile>
  );
}

function RhythmPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex min-w-0 items-baseline gap-1.5 rounded-full bg-raised px-3 py-1.5">
      <dt className="text-[11.5px] font-medium text-ink-3">{label}</dt>
      <dd className="text-[14px] font-semibold tracking-[-0.02em] text-ink tabular-nums">
        {value}
      </dd>
    </div>
  );
}
