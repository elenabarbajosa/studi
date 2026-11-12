import type {
  StudyRoomPhase,
  StudyRoomRunState,
  StudyRoomTimerState,
} from "@/lib/study-together/types";

/**
 * Client-side remaining time from authoritative server timestamps.
 * `serverNowMs` should be Date.now() + clockOffsetMs.
 */
export function remainingMsFromTimer(
  timer: Pick<
    StudyRoomTimerState,
    | "run_state"
    | "phase"
    | "phase_ends_at"
    | "remaining_ms_when_paused"
    | "phase_duration_ms"
  >,
  serverNowMs: number,
): number | null {
  if (timer.phase === "idle" || timer.run_state === "idle") return null;
  if (timer.run_state === "paused") {
    return timer.remaining_ms_when_paused ?? 0;
  }
  if (timer.run_state === "running" && timer.phase_ends_at) {
    const ends = Date.parse(timer.phase_ends_at);
    if (Number.isNaN(ends)) return 0;
    return Math.max(0, ends - serverNowMs);
  }
  return timer.phase_duration_ms || 0;
}

export function progress01FromTimer(
  timer: Pick<
    StudyRoomTimerState,
    | "run_state"
    | "phase"
    | "phase_ends_at"
    | "remaining_ms_when_paused"
    | "phase_duration_ms"
  >,
  serverNowMs: number,
): number {
  if (!timer.phase_duration_ms || timer.phase === "idle") return 0;
  const remaining = remainingMsFromTimer(timer, serverNowMs);
  if (remaining == null) return 0;
  const elapsed = timer.phase_duration_ms - remaining;
  return Math.min(1, Math.max(0, elapsed / timer.phase_duration_ms));
}

export function formatTimerMs(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function shouldPreferRevision(
  incoming: number,
  current: number,
): boolean {
  return incoming > current;
}

export function derivePersonalPresence(
  roomPhase: StudyRoomPhase,
  roomRun: StudyRoomRunState,
  personallyFocusing: boolean,
): "focusing" | "on_break" | "idle" {
  if (roomPhase === "short_break" || roomPhase === "long_break") {
    return "on_break";
  }
  if (roomPhase === "focus" && roomRun === "running" && personallyFocusing) {
    return "focusing";
  }
  if (roomPhase === "focus" && roomRun === "paused" && personallyFocusing) {
    return "focusing";
  }
  return "idle";
}

/**
 * Accrue personal focus ms only while the shared phase is focus+running
 * and the participant opted into focusing. Breaks never count.
 */
export function accruePersonalFocusMs(input: {
  roomPhase: StudyRoomPhase;
  roomRun: StudyRoomRunState;
  personallyFocusing: boolean;
  connected: boolean;
  deltaMs: number;
}): number {
  if (!input.connected || !input.personallyFocusing) return 0;
  if (input.roomPhase !== "focus" || input.roomRun !== "running") return 0;
  return Math.max(0, input.deltaMs);
}

export function estimateClockOffsetMs(
  serverIso: string,
  localReceivedAtMs: number,
): number {
  const serverMs = Date.parse(serverIso);
  if (Number.isNaN(serverMs)) return 0;
  return serverMs - localReceivedAtMs;
}
