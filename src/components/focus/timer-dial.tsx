import { cn } from "@/lib/utils";

const R = 164;
const C = 2 * Math.PI * R;

/**
 * Fluid timer ring: scales with its container, and the type scales with it
 * through container units, so the 92px desktop timer stays inside the ring.
 */
export function TimerDial({
  progress,
  time,
  label,
  cycle,
  tone = "light",
  onToggle,
  toggleLabel,
  className,
}: {
  progress: number;
  time: string;
  label: string;
  cycle?: { total: number; done: number; current: boolean };
  tone?: "light" | "dark";
  onToggle?: () => void;
  toggleLabel?: string;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const dark = tone === "dark";
  const long = time.length > 5;

  const body = (
    <>
      <svg viewBox="0 0 360 360" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle
          cx={180}
          cy={180}
          r={R}
          fill="none"
          strokeWidth={12}
          className={dark ? "stroke-white/10" : "stroke-[color-mix(in_srgb,var(--accent)_30%,transparent)]"}
        />
        {clamped > 0 ? (
          <circle
            cx={180}
            cy={180}
            r={R}
            fill="none"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - clamped)}
            className={cn(
              "transition-[stroke-dashoffset] duration-700 ease-linear motion-reduce:transition-none",
              dark ? "stroke-accent" : "stroke-accent-ink dark:stroke-accent",
            )}
          />
        ) : null}
      </svg>
      <span className="relative flex flex-col items-center">
        <span
          className={cn(
            "text-[3.4cqw] font-semibold tracking-[0.12em] uppercase",
            dark ? "text-white/60" : "text-accent-text",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "mt-[1.5cqw] font-semibold tracking-[-0.05em] tabular-nums",
            long ? "text-[18cqw]/none" : "text-[25.5cqw]/none",
            dark ? "text-white" : "text-ink",
          )}
          aria-live="polite"
          aria-atomic
        >
          {time}
        </span>
        {cycle && cycle.total > 0 ? (
          <span className="mt-[3.5cqw] flex gap-[1.6cqw]" aria-hidden>
            {Array.from({ length: cycle.total }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[2.2cqw] rounded-full transition-[width,background-color] duration-300 ease-studi",
                  i === cycle.done && cycle.current ? "w-[6cqw]" : "w-[2.2cqw]",
                  i < cycle.done
                    ? dark
                      ? "bg-accent"
                      : "bg-accent-ink dark:bg-accent"
                    : i === cycle.done && cycle.current
                      ? dark
                        ? "bg-white/70"
                        : "bg-ink-3"
                      : dark
                        ? "bg-white/15"
                        : "bg-[color-mix(in_srgb,var(--accent)_35%,transparent)]",
                )}
              />
            ))}
          </span>
        ) : null}
      </span>
    </>
  );

  const frame = cn(
    "@container relative mx-auto flex aspect-square w-full items-center justify-center rounded-full",
    className,
  );

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        className={cn(
          frame,
          "outline-none focus-visible:shadow-[0_0_0_2px_#171315,0_0_0_4px_var(--accent)]",
        )}
      >
        {body}
      </button>
    );
  }

  return <div className={frame}>{body}</div>;
}
