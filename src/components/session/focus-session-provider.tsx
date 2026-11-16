"use client";

import * as React from "react";
import { toast } from "sonner";

import { heartbeatFocusSession } from "@/actions/focus";
import {
  useSoundscapePlayer,
  type SoundscapePlayer,
} from "@/components/focus/soundscape-controls";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { useStudyPresence } from "@/hooks/use-study-presence";
import type { SoundscapeId } from "@/lib/calendar";
import {
  defaultFocusConfig,
  FOCUS_STORAGE_KEY,
  type FocusConfig,
  type FocusPreferences,
} from "@/lib/focus/types";
import type { PresenceStatus } from "@/lib/social";

type FocusTimerApi = ReturnType<typeof useFocusTimer>;

type SoundscapeState = {
  primary: SoundscapeId;
  secondary: SoundscapeId;
  volume: number;
  secondaryVolume: number;
  enabled: boolean;
};

type FocusSessionContextValue = {
  timer: FocusTimerApi;
  player: SoundscapePlayer;
  soundscape: SoundscapeState;
  setPrimary: (id: SoundscapeId) => void;
  setSecondary: (id: SoundscapeId) => void;
  setVolume: (v: number) => void;
  setSecondaryVolume: (v: number) => void;
  /** Apply prefs from Focus page when the session is idle. */
  hydrateFromPreferences: (prefs: FocusPreferences) => void;
  /** Clear engine + localStorage after logout / account switch. */
  hardReset: () => void;
};

const FocusSessionContext =
  React.createContext<FocusSessionContextValue | null>(null);

export function FocusSessionProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const timer = useFocusTimer(defaultFocusConfig(), { userId });
  const [soundscape, setSoundscape] = React.useState<SoundscapeState>({
    primary: "silence",
    secondary: "silence",
    volume: 0.45,
    secondaryVolume: 0,
    enabled: true,
  });
  const player = useSoundscapePlayer({
    enabled: soundscape.enabled,
    volume: soundscape.volume,
    secondaryVolume: soundscape.secondaryVolume,
  });

  const { engine } = timer;
  const active = engine.runState === "running" || engine.runState === "paused";

  const presenceStatus: PresenceStatus = !active
    ? "offline"
    : engine.phase === "short_break" || engine.phase === "long_break"
      ? "on_break"
      : "focusing";

  useStudyPresence({
    enabled: active,
    status: presenceStatus,
    activityLabel:
      presenceStatus === "focusing"
        ? "Focusing"
        : presenceStatus === "on_break"
          ? "On break"
          : null,
  });

  React.useEffect(() => {
    timer.setOnPhaseComplete((phase) => {
      if (soundscape.enabled) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = phase.includes("break") ? 523 : 440;
          gain.gain.value = 0.08;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } catch {
          /* autoplay / audio blocked */
        }
      }
      toast.message(
        phase === "focus" ? "Focus interval complete" : "Break complete",
      );
    });
  }, [soundscape.enabled, timer]);

  React.useEffect(() => {
    if (!timer.clientSessionId || !active) return;
    const id = window.setInterval(() => {
      void heartbeatFocusSession({
        client_session_id: timer.clientSessionId!,
        engine_state: timer.engine as unknown as Record<string, unknown>,
        focus_seconds: Math.round(timer.engine.totalFocusMs / 1000),
        break_seconds: Math.round(timer.engine.totalBreakMs / 1000),
      });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [timer.clientSessionId, active, timer.engine]);

  const timerRef = React.useRef(timer);
  const playerRef = React.useRef(player);

  React.useEffect(() => {
    timerRef.current = timer;
    playerRef.current = player;
  }, [timer, player]);

  const hardReset = React.useCallback(() => {
    timerRef.current.reset();
    timerRef.current.clearSession();
    // Soft pause (fade) is fine for UX stops; dispose path handles hard cleanup.
    playerRef.current.stop();
    try {
      window.localStorage.removeItem(FOCUS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const prevUserId = React.useRef(userId);
  React.useEffect(() => {
    if (prevUserId.current === userId) return;
    prevUserId.current = userId;
    hardReset();
  }, [userId, hardReset]);

  const hydrateFromPreferences = React.useCallback(
    (prefs: FocusPreferences) => {
      // Only seed defaults while idle so an in-flight session keeps its ambience.
      if (timerRef.current.engine.runState !== "idle") return;
      setSoundscape({
        primary: prefs.soundscape_primary,
        secondary: prefs.soundscape_secondary,
        volume: prefs.soundscape_volume,
        secondaryVolume: prefs.soundscape_secondary_volume,
        enabled: prefs.focus_sound_enabled,
      });
      const next: FocusConfig = defaultFocusConfig(prefs);
      timerRef.current.applyConfig(next);
    },
    [],
  );

  const value = React.useMemo<FocusSessionContextValue>(
    () => ({
      timer,
      player,
      soundscape,
      setPrimary: (id) => setSoundscape((s) => ({ ...s, primary: id })),
      setSecondary: (id) => setSoundscape((s) => ({ ...s, secondary: id })),
      setVolume: (v) => setSoundscape((s) => ({ ...s, volume: v })),
      setSecondaryVolume: (v) =>
        setSoundscape((s) => ({ ...s, secondaryVolume: v })),
      hydrateFromPreferences,
      hardReset,
    }),
    [timer, player, soundscape, hydrateFromPreferences, hardReset],
  );

  return (
    <FocusSessionContext.Provider value={value}>
      {children}
    </FocusSessionContext.Provider>
  );
}

export function useFocusSession() {
  const ctx = React.useContext(FocusSessionContext);
  if (!ctx) {
    throw new Error("useFocusSession must be used within FocusSessionProvider");
  }
  return ctx;
}
