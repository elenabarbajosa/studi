import type { FocusTimerMode } from "@/lib/calendar";
import { pause, tick } from "@/lib/focus/timer-engine";
import type {
  FocusEngineState,
  TimerPhase,
  TimerRunState,
} from "@/lib/focus/types";

export type FocusSessionMeta = {
  subjectId: string | null;
  topicId: string | null;
  taskId: string | null;
  goal: string;
  startedAtIso: string;
};

/** Authoritative snapshot shared across devices. */
export type FocusSessionSnapshot = {
  clientSessionId: string;
  revision: number;
  timerMode: FocusTimerMode;
  subjectId: string | null;
  topicId: string | null;
  taskId: string | null;
  goal: string;
  startedAtIso: string;
  engine: FocusEngineState;
  focusSeconds: number;
  breakSeconds: number;
  lastHeartbeatAt: string;
  updatedAt: string;
};

const ENGINE_PHASES: TimerPhase[] = [
  "focus",
  "short_break",
  "long_break",
  "stopwatch",
];
const ENGINE_RUN: TimerRunState[] = ["idle", "running", "paused", "finished"];

export function isFocusEngineState(value: unknown): value is FocusEngineState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.mode === "pomodoro" || v.mode === "stopwatch") &&
    typeof v.phase === "string" &&
    ENGINE_PHASES.includes(v.phase as TimerPhase) &&
    typeof v.runState === "string" &&
    ENGINE_RUN.includes(v.runState as TimerRunState) &&
    (v.segmentStartedAt === null || typeof v.segmentStartedAt === "number") &&
    typeof v.phaseElapsedMs === "number" &&
    (v.phaseDurationMs === null || typeof v.phaseDurationMs === "number") &&
    typeof v.completedFocusIntervals === "number" &&
    typeof v.totalFocusMs === "number" &&
    typeof v.totalBreakMs === "number"
  );
}

export function parseEngineState(raw: unknown): FocusEngineState | null {
  if (!isFocusEngineState(raw)) return null;
  return raw;
}

/** Prefer remote when its revision is strictly newer. */
export function shouldPreferRemoteRevision(
  localRevision: number,
  remoteRevision: number,
): boolean {
  return remoteRevision > localRevision;
}

/**
 * LocalStorage must never overwrite newer server state for the same session.
 * Different client_session_id means a different session entirely.
 */
export function shouldPreferServerOverLocal(input: {
  server: FocusSessionSnapshot | null;
  localClientSessionId: string | null;
  localRevision: number;
}): boolean {
  if (!input.server) return false;
  if (!input.localClientSessionId) return true;
  if (input.server.clientSessionId !== input.localClientSessionId) {
    // Server is authoritative for "the" active session (one per user).
    return true;
  }
  return shouldPreferRemoteRevision(input.localRevision, input.server.revision);
}

/**
 * Restore a running timer from an authoritative snapshot.
 *
 * Unlike tab-sleep recovery, we advance with wall-clock `now` so remaining
 * time matches elapsed wall time (refresh / cross-device). Extremely stale
 * heartbeats pause at the last heartbeat so abandoned sessions are not credited.
 */
export function restoreEngineFromAuthoritative(input: {
  engine: FocusEngineState;
  nowMs: number;
  lastHeartbeatAtMs: number;
  /** After this gap without heartbeat, freeze at lastHeartbeatAt. */
  abandonAfterMs?: number;
}): FocusEngineState {
  const abandonAfterMs = input.abandonAfterMs ?? 2 * 60 * 60 * 1000;
  const { engine, nowMs, lastHeartbeatAtMs } = input;

  if (engine.runState !== "running" || engine.segmentStartedAt == null) {
    return engine;
  }

  if (nowMs - lastHeartbeatAtMs > abandonAfterMs) {
    return pause(engine, lastHeartbeatAtMs);
  }

  return tick(engine, nowMs).state;
}

/**
 * Estimate local clock offset from a server timestamp.
 * Positive means local clock is behind the server.
 */
export function estimateClockOffsetMs(
  serverIso: string,
  localNowMs: number,
): number {
  const serverMs = Date.parse(serverIso);
  if (Number.isNaN(serverMs)) return 0;
  return serverMs - localNowMs;
}

export function serverAlignedNow(
  localNowMs: number,
  clockOffsetMs: number,
): number {
  return localNowMs + clockOffsetMs;
}

export function snapshotFromActiveRow(row: {
  client_session_id: string;
  revision?: number | null;
  timer_mode: FocusTimerMode;
  subject_id: string | null;
  topic_id: string | null;
  task_id: string | null;
  goal: string | null;
  started_at: string;
  engine_state: unknown;
  focus_seconds: number;
  break_seconds: number;
  last_heartbeat_at: string;
  updated_at: string;
}): FocusSessionSnapshot | null {
  const engine = parseEngineState(row.engine_state);
  if (!engine) return null;
  return {
    clientSessionId: row.client_session_id,
    revision: Math.max(1, Number(row.revision ?? 1)),
    timerMode: row.timer_mode,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    taskId: row.task_id,
    goal: row.goal ?? "",
    startedAtIso: row.started_at,
    engine,
    focusSeconds: row.focus_seconds,
    breakSeconds: row.break_seconds,
    lastHeartbeatAt: row.last_heartbeat_at,
    updatedAt: row.updated_at,
  };
}

/** Heartbeat older than this is treated as reclaimable when starting a new session. */
export const FOCUS_SESSION_STALE_MS = 10 * 60 * 1000;

export function isActiveSessionStale(
  lastHeartbeatAtIso: string,
  nowMs: number,
  staleMs = FOCUS_SESSION_STALE_MS,
): boolean {
  const t = Date.parse(lastHeartbeatAtIso);
  if (Number.isNaN(t)) return true;
  return nowMs - t > staleMs;
}
