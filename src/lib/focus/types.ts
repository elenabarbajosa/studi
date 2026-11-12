import type { FocusTimerMode, SoundscapeId } from "@/lib/calendar";

export type TimerPhase = "focus" | "short_break" | "long_break" | "stopwatch";

export type TimerRunState = "idle" | "running" | "paused" | "finished";

/** Pure engine snapshot — serializable for localStorage / DB / future room sync. */
export type FocusEngineState = {
  mode: FocusTimerMode;
  phase: TimerPhase;
  runState: TimerRunState;
  /** Wall-clock ms when the current running segment started (null if paused/idle). */
  segmentStartedAt: number | null;
  /** Accumulated ms in the current phase before the active segment. */
  phaseElapsedMs: number;
  /** Target duration for countdown phases (null for stopwatch). */
  phaseDurationMs: number | null;
  /** Completed focus intervals in this session (Pomodoro). */
  completedFocusIntervals: number;
  /** Lifetime focus ms this session (excludes breaks). */
  totalFocusMs: number;
  /** Lifetime break ms this session. */
  totalBreakMs: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  intervalsBeforeLong: number;
  autoStartBreaks: boolean;
};

export type FocusConfig = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  intervalsBeforeLong: number;
  autoStartBreaks: boolean;
  soundEnabled: boolean;
};

export type FocusSessionMeta = {
  clientSessionId: string;
  subjectId: string | null;
  topicId: string | null;
  taskId: string | null;
  goal: string;
};

export type FocusPreferences = {
  pomodoro_focus_minutes: number;
  pomodoro_short_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_intervals_before_long: number;
  auto_start_breaks: boolean;
  focus_sound_enabled: boolean;
  soundscape_primary: SoundscapeId;
  soundscape_secondary: SoundscapeId;
  soundscape_volume: number;
  soundscape_secondary_volume: number;
};

export const FOCUS_HEARTBEAT_STALE_MS = 5 * 60 * 1000;
export const FOCUS_STORAGE_KEY = "studi-focus-engine-v1";

export function defaultFocusConfig(
  prefs?: Partial<FocusPreferences> | null,
): FocusConfig {
  return {
    focusMinutes: prefs?.pomodoro_focus_minutes ?? 25,
    shortBreakMinutes: prefs?.pomodoro_short_break_minutes ?? 5,
    longBreakMinutes: prefs?.pomodoro_long_break_minutes ?? 15,
    intervalsBeforeLong: prefs?.pomodoro_intervals_before_long ?? 4,
    autoStartBreaks: prefs?.auto_start_breaks ?? false,
    soundEnabled: prefs?.focus_sound_enabled ?? true,
  };
}
