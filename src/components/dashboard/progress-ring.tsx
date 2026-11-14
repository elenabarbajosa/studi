import { cn } from "@/lib/utils";

type ProgressRingProps = {
  size: number;
  radius: number;
  stroke: number;
  /** 0–1; values outside the range are clamped. */
  value: number;
  trackClassName?: string;
  indicatorClassName?: string;
  className?: string;
  children?: React.ReactNode;
};

export function ProgressRing({
  size,
  radius,
  stroke,
  value,
  trackClassName = "stroke-hairline",
  indicatorClassName = "stroke-accent",
  className,
  children,
}: ProgressRingProps) {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  const center = size / 2;

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClassName}
        />
        {clamped > 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            className={cn(
              "transition-[stroke-dashoffset] duration-300 ease-studi motion-reduce:transition-none",
              indicatorClassName,
            )}
          />
        ) : null}
      </svg>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}
