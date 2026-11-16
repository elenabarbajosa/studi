import type { TimerRunState } from "@/lib/focus/types";

/** Focus mini-player is hidden on the full Focus route to avoid duplicate controls. */
export function isFocusFullRoute(pathname: string): boolean {
  return pathname === "/focus" || pathname.startsWith("/focus/");
}

/** Study Together mini-player is hidden on the matching room route. */
export function isStudyTogetherRoomRoute(
  pathname: string,
  roomId: string,
): boolean {
  return (
    pathname === `/study-together/${roomId}` ||
    pathname.startsWith(`/study-together/${roomId}/`)
  );
}

export function shouldShowFocusMiniPlayer(
  pathname: string,
  runState: TimerRunState,
): boolean {
  if (isFocusFullRoute(pathname)) return false;
  return (
    runState === "running" ||
    runState === "paused" ||
    runState === "finished"
  );
}

export function shouldShowStudyTogetherMiniPlayer(
  pathname: string,
  roomId: string | null,
): boolean {
  if (!roomId) return false;
  return !isStudyTogetherRoomRoute(pathname, roomId);
}

export function focusPhaseStatusLabel(input: {
  runState: TimerRunState;
  phase: string;
}): string {
  if (input.runState === "paused") return "Paused";
  if (input.runState === "finished") return "Finished";
  if (input.phase === "short_break") return "Short break";
  if (input.phase === "long_break") return "Long break";
  if (input.phase === "stopwatch") return "Running";
  return "Focusing";
}
