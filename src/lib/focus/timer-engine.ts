import type { FocusTimerMode } from "@/lib/calendar";
import type { FocusConfig, FocusEngineState, TimerPhase } from "@/lib/focus/types";

function minutesToMs(m: number) {
  return Math.max(1, m) * 60_000;
}

function phaseDurationMs(phase: TimerPhase, config: FocusConfig): number | null {
  if (phase === "stopwatch") return null;
  if (phase === "focus") return minutesToMs(config.focusMinutes);
  if (phase === "short_break") return minutesToMs(config.shortBreakMinutes);
  return minutesToMs(config.longBreakMinutes);
}

function isFocusPhase(phase: TimerPhase) {
  return phase === "focus" || phase === "stopwatch";
}

/** Create a fresh idle engine for the selected mode. */
export function createEngine(
  mode: FocusTimerMode,
  config: FocusConfig,
): FocusEngineState {
  const phase: TimerPhase = mode === "stopwatch" ? "stopwatch" : "focus";
  return {
    mode,
    phase,
    runState: "idle",
    segmentStartedAt: null,
    phaseElapsedMs: 0,
    phaseDurationMs: phaseDurationMs(phase, config),
    completedFocusIntervals: 0,
    totalFocusMs: 0,
    totalBreakMs: 0,
    focusMinutes: config.focusMinutes,
    shortBreakMinutes: config.shortBreakMinutes,
    longBreakMinutes: config.longBreakMinutes,
    intervalsBeforeLong: config.intervalsBeforeLong,
    autoStartBreaks: config.autoStartBreaks,
  };
}

function configFromState(state: FocusEngineState): FocusConfig {
  return {
    focusMinutes: state.focusMinutes,
    shortBreakMinutes: state.shortBreakMinutes,
    longBreakMinutes: state.longBreakMinutes,
    intervalsBeforeLong: state.intervalsBeforeLong,
    autoStartBreaks: state.autoStartBreaks,
    soundEnabled: true,
  };
}

/** Elapsed ms in the current phase at wall-clock `now`. */
export function currentPhaseElapsedMs(state: FocusEngineState, now: number) {
  if (state.runState !== "running" || state.segmentStartedAt == null) {
    return state.phaseElapsedMs;
  }
  return state.phaseElapsedMs + Math.max(0, now - state.segmentStartedAt);
}

/** Remaining ms for countdown phases (0 when done). Null for stopwatch. */
export function remainingMs(state: FocusEngineState, now: number) {
  if (state.phaseDurationMs == null) return null;
  return Math.max(0, state.phaseDurationMs - currentPhaseElapsedMs(state, now));
}

export function displayMs(state: FocusEngineState, now: number) {
  if (state.mode === "stopwatch" || state.phase === "stopwatch") {
    return currentPhaseElapsedMs(state, now);
  }
  return remainingMs(state, now) ?? 0;
}

export function progress01(state: FocusEngineState, now: number) {
  if (state.phaseDurationMs == null || state.phaseDurationMs <= 0) return 0;
  return Math.min(1, currentPhaseElapsedMs(state, now) / state.phaseDurationMs);
}

function commitSegment(state: FocusEngineState, now: number): FocusEngineState {
  if (state.runState !== "running" || state.segmentStartedAt == null) {
    return state;
  }
  const delta = Math.max(0, now - state.segmentStartedAt);
  const nextElapsed = state.phaseElapsedMs + delta;
  const next: FocusEngineState = {
    ...state,
    phaseElapsedMs: nextElapsed,
    segmentStartedAt: null,
  };
  if (isFocusPhase(state.phase)) {
    next.totalFocusMs = state.totalFocusMs + delta;
  } else {
    next.totalBreakMs = state.totalBreakMs + delta;
  }
  return next;
}

export function start(state: FocusEngineState, now: number): FocusEngineState {
  if (state.runState === "running") return state;
  if (state.runState === "finished") {
    return start(createEngine(state.mode, configFromState(state)), now);
  }
  return {
    ...state,
    runState: "running",
    segmentStartedAt: now,
  };
}

export function pause(state: FocusEngineState, now: number): FocusEngineState {
  if (state.runState !== "running") return state;
  const committed = commitSegment(state, now);
  return { ...committed, runState: "paused" };
}

export function resume(state: FocusEngineState, now: number): FocusEngineState {
  if (state.runState !== "paused") return state;
  return {
    ...state,
    runState: "running",
    segmentStartedAt: now,
  };
}

export function reset(state: FocusEngineState): FocusEngineState {
  return createEngine(state.mode, configFromState(state));
}

function nextPhaseAfterFocus(state: FocusEngineState): TimerPhase {
  const completed = state.completedFocusIntervals + 1;
  if (completed % state.intervalsBeforeLong === 0) return "long_break";
  return "short_break";
}

/**
 * Advance the engine to `now`. Completes countdown phases when elapsed >= duration.
 * Does not invent unattended time beyond `now` — caller supplies wall clock.
 */
export function tick(
  state: FocusEngineState,
  now: number,
): { state: FocusEngineState; phaseCompleted: boolean; completedPhase: TimerPhase | null } {
  if (state.runState !== "running") {
    return { state, phaseCompleted: false, completedPhase: null };
  }

  if (state.phaseDurationMs == null) {
    // Stopwatch — no auto complete
    return { state, phaseCompleted: false, completedPhase: null };
  }

  const elapsed = currentPhaseElapsedMs(state, now);
  if (elapsed < state.phaseDurationMs) {
    return { state, phaseCompleted: false, completedPhase: null };
  }

  // Phase complete: commit exactly the phase duration for the last segment.
  const segmentStart = state.segmentStartedAt ?? now;
  const needed = state.phaseDurationMs - state.phaseElapsedMs;
  const commitAt = segmentStart + needed;
  let next = commitSegment(state, commitAt);
  const completedPhase = next.phase;

  if (completedPhase === "focus") {
    next = {
      ...next,
      completedFocusIntervals: next.completedFocusIntervals + 1,
    };
    const breakPhase = nextPhaseAfterFocus(next);
    next = {
      ...next,
      phase: breakPhase,
      phaseElapsedMs: 0,
      phaseDurationMs: phaseDurationMs(breakPhase, configFromState(next)),
      runState: next.autoStartBreaks ? "running" : "paused",
      segmentStartedAt: next.autoStartBreaks ? commitAt : null,
    };
  } else {
    // Break finished → back to focus
    next = {
      ...next,
      phase: "focus",
      phaseElapsedMs: 0,
      phaseDurationMs: phaseDurationMs("focus", configFromState(next)),
      runState: next.autoStartBreaks ? "running" : "paused",
      segmentStartedAt: next.autoStartBreaks ? commitAt : null,
    };
  }

  return { state: next, phaseCompleted: true, completedPhase };
}

/** Finish the whole session — commit running segment and mark finished. */
export function finish(state: FocusEngineState, now: number): FocusEngineState {
  const committed = commitSegment(state, now);
  return {
    ...committed,
    runState: "finished",
    segmentStartedAt: null,
  };
}

/**
 * Recover after a tab sleep / refresh gap.
 * If the gap since last known activity exceeds `staleMs`, freeze at last
 * committed elapsed (do not credit the unattended gap as focus time).
 */
export function recoverAfterGap(
  state: FocusEngineState,
  now: number,
  lastKnownAt: number,
  staleMs: number,
): FocusEngineState {
  if (state.runState !== "running" || state.segmentStartedAt == null) {
    return state;
  }
  const gap = now - lastKnownAt;
  if (gap > staleMs) {
    // Pause at lastKnownAt so unattended time is not counted.
    return pause(state, lastKnownAt);
  }
  return tick(state, now).state;
}

export function formatTimer(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDurationMinutes(ms: number) {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
