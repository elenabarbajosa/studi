"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const R = 164;
const C = 2 * Math.PI * R;
const CX = 180;
const CY = 180;

export const FOCUS_DURATION_MIN = 5;
export const FOCUS_DURATION_MAX = 120;
export const FOCUS_DURATION_STEP = 5;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snap(n: number, step: number) {
  return Math.round(n / step) * step;
}

export function snapFocusMinutes(raw: number) {
  return clamp(snap(raw, FOCUS_DURATION_STEP), FOCUS_DURATION_MIN, FOCUS_DURATION_MAX);
}

/** Map pointer angle (from 12 o'clock, clockwise) to minutes. */
function angleToMinutes(angleDeg: number) {
  const t = ((angleDeg % 360) + 360) % 360;
  const ratio = t / 360;
  const raw =
    FOCUS_DURATION_MIN +
    ratio * (FOCUS_DURATION_MAX - FOCUS_DURATION_MIN);
  return snapFocusMinutes(raw);
}

function minutesToAngle(minutes: number) {
  const clamped = clamp(minutes, FOCUS_DURATION_MIN, FOCUS_DURATION_MAX);
  const ratio =
    (clamped - FOCUS_DURATION_MIN) /
    (FOCUS_DURATION_MAX - FOCUS_DURATION_MIN);
  return ratio * 360;
}

function minutesToProgress(minutes: number) {
  return clamp(
    (minutes - FOCUS_DURATION_MIN) /
      (FOCUS_DURATION_MAX - FOCUS_DURATION_MIN),
    0,
    1,
  );
}

function pointerAngleFromEvent(
  clientX: number,
  clientY: number,
  rect: DOMRect,
) {
  const x = clientX - (rect.left + rect.width / 2);
  const y = clientY - (rect.top + rect.height / 2);
  // atan2 from positive x; convert so 0° is top, clockwise positive
  const rad = Math.atan2(y, x);
  let deg = (rad * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  return deg;
}

function handlePoint(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + R * Math.cos(rad),
    y: CY + R * Math.sin(rad),
  };
}

/**
 * Fluid timer ring. Idle Pomodoro mode can act as a radial duration scrubber;
 * during a session it is read-only progress.
 */
export function TimerDial({
  progress,
  time,
  label,
  cycle,
  tone = "light",
  onToggle,
  toggleLabel,
  interactive = false,
  durationMinutes,
  onDurationChange,
  className,
}: {
  progress: number;
  time: string;
  label: string;
  cycle?: { total: number; done: number; current: boolean };
  tone?: "light" | "dark";
  onToggle?: () => void;
  toggleLabel?: string;
  /** When true (idle Pomodoro), ring scrubbing adjusts duration. */
  interactive?: boolean;
  durationMinutes?: number;
  onDurationChange?: (minutes: number) => void;
  className?: string;
}) {
  const dark = tone === "dark";
  const long = time.length > 5;
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const sliderId = useId();

  const showScrub =
    interactive &&
    typeof durationMinutes === "number" &&
    typeof onDurationChange === "function";

  const scrubProgress = showScrub
    ? minutesToProgress(durationMinutes)
    : Math.min(1, Math.max(0, progress));
  const handleAngle = showScrub ? minutesToAngle(durationMinutes) : scrubProgress * 360;
  const handle = handlePoint(handleAngle);

  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!showScrub || !onDurationChange || !rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      onDurationChange(angleToMinutes(pointerAngleFromEvent(clientX, clientY, rect)));
    },
    [onDurationChange, showScrub],
  );

  useEffect(() => {
    if (!dragging) return;

    function onMove(e: PointerEvent) {
      e.preventDefault();
      applyFromPointer(e.clientX, e.clientY);
    }
    function onUp() {
      draggingRef.current = false;
      setDragging(false);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyFromPointer, dragging]);

  const startDrag = (e: React.PointerEvent) => {
    if (!showScrub) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    setDragging(true);
    applyFromPointer(e.clientX, e.clientY);
  };

  const glowClass = dark
    ? "shadow-[0_0_48px_-8px_color-mix(in_srgb,var(--accent)_55%,transparent)]"
    : "shadow-[0_0_56px_-10px_color-mix(in_srgb,var(--accent)_45%,transparent)]";

  const ringStroke = dark
    ? "stroke-accent"
    : "stroke-accent-ink dark:stroke-accent";

  const trackStroke = dark
    ? "stroke-white/10"
    : "stroke-[color-mix(in_srgb,var(--accent)_22%,transparent)]";

  const body = (
    <>
      {/* Soft depth disc behind the ring */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-[8%] rounded-full",
          dark
            ? "bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.08),transparent_68%)]"
            : "bg-[radial-gradient(circle_at_50%_38%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_70%)]",
          glowClass,
        )}
      />

      <svg viewBox="0 0 360 360" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id={`${sliderId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop
              offset="0%"
              stopColor="var(--accent)"
              stopOpacity={dark ? 0.95 : 0.75}
            />
            <stop
              offset="100%"
              stopColor="var(--accent-ink, var(--accent))"
              stopOpacity={1}
            />
          </linearGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="none" strokeWidth={14} className={trackStroke} />
        {scrubProgress > 0.001 ? (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - scrubProgress)}
            stroke={`url(#${sliderId}-grad)`}
            transform={`rotate(-90 ${CX} ${CY})`}
            className={cn(
              showScrub
                ? "transition-[stroke-dashoffset] duration-75 ease-out motion-reduce:transition-none"
                : "transition-[stroke-dashoffset] duration-700 ease-linear motion-reduce:transition-none",
              !showScrub && ringStroke,
            )}
          />
        ) : null}
        {showScrub ? (
          <g>
            <circle
              cx={handle.x}
              cy={handle.y}
              r={dragging ? 16 : 14}
              className={cn(
                "transition-[r] duration-150",
                dark ? "fill-accent" : "fill-accent-ink dark:fill-accent",
              )}
              style={{
                filter: dark
                  ? "drop-shadow(0 2px 8px rgba(0,0,0,0.45))"
                  : "drop-shadow(0 2px 10px color-mix(in srgb, var(--accent) 40%, transparent))",
              }}
            />
            <circle
              cx={handle.x}
              cy={handle.y}
              r={5}
              className={dark ? "fill-[#241c1f]" : "fill-canvas"}
            />
          </g>
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
          role="timer"
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
        {showScrub ? (
          <span
            className={cn(
              "mt-[2.8cqw] text-[3cqw] font-medium",
              dark ? "text-white/45" : "text-ink-3",
            )}
          >
            Drag to set · {durationMinutes}m
          </span>
        ) : null}
      </span>

      {showScrub ? (
        <>
          {/* Invisible hit target around the ring for scrubbing */}
          <button
            type="button"
            aria-label={`Focus duration ${durationMinutes} minutes. Drag around the ring to adjust.`}
            className="absolute inset-0 z-[1] cursor-grab rounded-full outline-none active:cursor-grabbing focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
            style={{
              // Donut hit area via mask — approximate with large transparent button + center pass-through
              WebkitMaskImage:
                "radial-gradient(circle, transparent 58%, #000 59%, #000 78%, transparent 79%)",
              maskImage:
                "radial-gradient(circle, transparent 58%, #000 59%, #000 78%, transparent 79%)",
            }}
            onPointerDown={startDrag}
          />
          <label htmlFor={sliderId} className="sr-only">
            Focus duration in minutes
          </label>
          <input
            id={sliderId}
            type="range"
            min={FOCUS_DURATION_MIN}
            max={FOCUS_DURATION_MAX}
            step={FOCUS_DURATION_STEP}
            value={durationMinutes}
            onChange={(e) => onDurationChange?.(Number(e.target.value))}
            className="sr-only"
          />
        </>
      ) : null}
    </>
  );

  const frame = cn(
    "@container relative mx-auto flex aspect-square w-full items-center justify-center rounded-full select-none",
    className,
  );

  if (onToggle && !showScrub) {
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

  return (
    <div ref={rootRef} className={frame}>
      {body}
    </div>
  );
}
