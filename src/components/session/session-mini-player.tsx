"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Maximize2,
  Pause,
  Play,
  Users,
  Timer,
} from "lucide-react";

import { useFocusSession } from "@/components/session/focus-session-provider";
import { useStudyTogetherSession } from "@/components/session/study-together-session-provider";
import {
  focusPhaseStatusLabel,
  shouldShowFocusMiniPlayer,
  shouldShowStudyTogetherMiniPlayer,
} from "@/lib/session/mini-player";
import { phaseLabel } from "@/lib/study-together/types";
import { cn } from "@/lib/utils";

const shellClass =
  "pointer-events-auto fixed z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-[22px] border border-hairline bg-raised/95 px-3 py-2.5 shadow-pop backdrop-blur-md supports-backdrop-filter:bg-raised/90";

/** Desktop: bottom-right. Mobile: above tab bar + safe area. */
const positionClass =
  "right-3 bottom-[calc(88px+env(safe-area-inset-bottom))] md:right-5 md:bottom-5";

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
    >
      {children}
    </button>
  );
}

function FocusMiniPlayer() {
  const pathname = usePathname();
  const { timer } = useFocusSession();
  const { engine } = timer;

  if (!shouldShowFocusMiniPlayer(pathname, engine.runState)) return null;

  const status = focusPhaseStatusLabel({
    runState: engine.runState,
    phase: engine.phase,
  });
  const canToggle =
    engine.runState === "running" || engine.runState === "paused";

  return (
    <div
      className={cn(shellClass, positionClass)}
      role="region"
      aria-label="Focus session mini player"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
        <Timer className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">Focus</p>
        <p className="truncate text-[12px] text-ink-2">
          <span className="font-semibold tabular-nums text-ink">
            {timer.display}
          </span>
          {" · "}
          {status}
        </p>
      </div>
      {canToggle ? (
        <ControlButton
          label={engine.runState === "running" ? "Pause" : "Resume"}
          onClick={() =>
            engine.runState === "running" ? timer.pause() : timer.resume()
          }
        >
          {engine.runState === "running" ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4 fill-current" aria-hidden />
          )}
        </ControlButton>
      ) : null}
      <Link
        href="/focus"
        aria-label="Return to Focus session"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas outline-none transition-opacity hover:opacity-90 focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] dark:bg-accent dark:text-ink-on-accent"
      >
        <Maximize2 className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function StudyTogetherMiniPlayer() {
  const pathname = usePathname();
  const { live } = useStudyTogetherSession();

  if (
    !live ||
    !shouldShowStudyTogetherMiniPlayer(pathname, live.room.id)
  ) {
    return null;
  }

  const { roomTimer, isHost, room } = live;
  const runState = roomTimer.timer?.run_state ?? "idle";
  const phase = roomTimer.timer?.phase ?? "idle";
  const canToggle =
    isHost && (runState === "running" || runState === "paused");
  const status =
    runState === "paused"
      ? "Paused"
      : runState === "running"
        ? phaseLabel(phase)
        : phase === "idle"
          ? "Waiting"
          : phaseLabel(phase);

  return (
    <div
      className={cn(shellClass, positionClass)}
      role="region"
      aria-label="Study Together mini player"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
        <Users className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">
          Study Together
        </p>
        <p className="truncate text-[12px] text-ink-2">
          <span className="font-semibold tabular-nums text-ink">
            {roomTimer.display}
          </span>
          {" · "}
          {status}
          {room.name ? ` · ${room.name}` : null}
        </p>
      </div>
      {canToggle ? (
        <ControlButton
          label={
            runState === "running"
              ? "Pause for everyone"
              : "Resume for everyone"
          }
          onClick={() => {
            void roomTimer.command(
              runState === "running" ? "pause" : "resume",
            );
          }}
        >
          {runState === "running" ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4 fill-current" aria-hidden />
          )}
        </ControlButton>
      ) : null}
      <Link
        href={`/study-together/${room.id}`}
        aria-label="Return to Study Together room"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas outline-none transition-opacity hover:opacity-90 focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] dark:bg-accent dark:text-ink-on-accent"
      >
        <Maximize2 className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

/**
 * Shows at most one mini-player. Study Together takes priority when both
 * sessions are active so room membership stays the primary chrome.
 */
export function SessionMiniPlayer() {
  const pathname = usePathname();
  const { live } = useStudyTogetherSession();
  const { timer } = useFocusSession();

  const showStudy =
    live &&
    shouldShowStudyTogetherMiniPlayer(pathname, live.room.id);
  const showFocus =
    !showStudy &&
    shouldShowFocusMiniPlayer(pathname, timer.engine.runState);

  if (showStudy) return <StudyTogetherMiniPlayer />;
  if (showFocus) return <FocusMiniPlayer />;
  return null;
}
