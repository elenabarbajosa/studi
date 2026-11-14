import { cn } from "@/lib/utils";

const MAX_SEGMENTS = 12;

/** One segment per root topic; a continuous bar once segments would get too thin. */
export function SegmentBar({
  total,
  filled,
  color,
  trackClassName = "bg-hairline",
  className,
}: {
  total: number;
  filled: number;
  color: string;
  trackClassName?: string;
  className?: string;
}) {
  if (total === 0) {
    return <span className={cn("block h-1.5 rounded-full", trackClassName, className)} aria-hidden />;
  }
  if (total > MAX_SEGMENTS) {
    return (
      <span className={cn("block h-1.5 overflow-hidden rounded-full", trackClassName, className)} aria-hidden>
        <span
          className="block h-full rounded-full"
          style={{ width: `${(filled / total) * 100}%`, background: color }}
        />
      </span>
    );
  }
  return (
    <span className={cn("flex gap-[3px]", className)} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn("h-1.5 flex-1 rounded-full", i >= filled && trackClassName)}
          style={i < filled ? { background: color } : undefined}
        />
      ))}
    </span>
  );
}

export function DifficultyBars({
  value,
  color,
  className,
}: {
  value: number | null;
  color: string;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span
      className={cn("flex items-center gap-[3px]", className)}
      title={`Difficulty ${value} of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden
          className={cn("h-3.5 w-[5px] rounded-[2px]", i > value && "bg-ink/10 dark:bg-white/15")}
          style={i <= value ? { background: color } : undefined}
        />
      ))}
      <span className="sr-only">Difficulty {value} of 5</span>
    </span>
  );
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

/** Calendar-page style date tile: weekday overline above the day number. */
export function DateBadge({
  iso,
  tone = "default",
  className,
}: {
  iso: string;
  tone?: "default" | "ink" | "subject";
  className?: string;
}) {
  const date = new Date(iso);
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[46px] shrink-0 flex-col items-center justify-center rounded-[14px] leading-none",
        tone === "ink" && "bg-white/10 text-white",
        tone === "subject" && "bg-raised/70 text-ink dark:bg-white/10",
        tone === "default" && "bg-sunken text-ink",
        className,
      )}
    >
      <span
        className={cn(
          "text-[10.5px] font-semibold uppercase",
          tone === "ink" ? "text-accent" : "text-accent-text",
        )}
      >
        {WEEKDAY.format(date)}
      </span>
      <span className="mt-0.5 text-[19px] font-semibold tabular-nums">{date.getDate()}</span>
    </span>
  );
}

/** Calm empty state: icon tile, title, one sentence, optional action. */
export function EmptyPanel({
  icon: Icon,
  title,
  body,
  action,
  className,
  compact,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 text-center",
        compact ? "py-8" : "py-12",
        className,
      )}
    >
      <span className="mb-1.5 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
        <Icon className="size-[22px]" aria-hidden />
      </span>
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-[13.5px] leading-snug text-ink-2">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
