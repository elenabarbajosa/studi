"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  fetchActiveFocusSession,
  heartbeatFocusSession,
} from "@/actions/focus";
import {
  useSoundscapePlayer,
  type SoundscapePlayer,
} from "@/components/focus/soundscape-controls";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { useStudyPresence } from "@/hooks/use-study-presence";
import type { SoundscapeId } from "@/lib/calendar";
import {
  shouldPreferServerOverLocal,
  snapshotFromActiveRow,
  type FocusSessionSnapshot,
} from "@/lib/focus/session-sync";
import {
  defaultFocusConfig,
  FOCUS_STORAGE_KEY,
  type FocusConfig,
  type FocusPreferences,
} from "@/lib/focus/types";
import type { PresenceStatus } from "@/lib/social";
import { createClient } from "@/lib/supabase/client";
import type { FocusActiveSession } from "@/types/database";

type FocusTimerApi = ReturnType<typeof useFocusTimer>;

type SoundscapeState = {
  primary: SoundscapeId;
  secondary: SoundscapeId;
  volume: number;
  secondaryVolume: number;
  enabled: boolean;
};

export type FocusSyncStatus = "idle" | "syncing" | "synced" | "offline" | "conflict";

type FocusSessionContextValue = {
  timer: FocusTimerApi;
  player: SoundscapePlayer;
  soundscape: SoundscapeState;
  syncStatus: FocusSyncStatus;
  setPrimary: (id: SoundscapeId) => void;
  setSecondary: (id: SoundscapeId) => void;
  setVolume: (v: number) => void;
  setSecondaryVolume: (v: number) => void;
  /** Apply prefs from Focus page when the session is idle. */
  hydrateFromPreferences: (prefs: FocusPreferences) => void;
  /** Push current timer state to the server immediately (pause/resume/phase). */
  pushSessionNow: () => Promise<void>;
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
  const [syncStatus, setSyncStatus] = React.useState<FocusSyncStatus>("idle");
  const player = useSoundscapePlayer({
    enabled: soundscape.enabled,
    volume: soundscape.volume,
    secondaryVolume: soundscape.secondaryVolume,
  });

  const { engine } = timer;
  const active = engine.runState === "running" || engine.runState === "paused";
  const finished = engine.runState === "finished";

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

  const timerRef = React.useRef(timer);
  const playerRef = React.useRef(player);
  const syncingRef = React.useRef(false);
  const hydratedServerRef = React.useRef(false);

  React.useEffect(() => {
    timerRef.current = timer;
    playerRef.current = player;
  }, [timer, player]);

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

  const applySnapshot = React.useCallback((snapshot: FocusSessionSnapshot) => {
    timerRef.current.hydrateFromSnapshot(snapshot);
  }, []);

  const pushSessionNow = React.useCallback(async () => {
    const current = timerRef.current;
    if (!current.clientSessionId || current.revision < 1) return;
    if (
      current.engine.runState !== "running" &&
      current.engine.runState !== "paused" &&
      current.engine.runState !== "finished"
    ) {
      return;
    }
    if (syncingRef.current || current.isApplyingRemote()) return;

    syncingRef.current = true;
    setSyncStatus("syncing");
    try {
      const result = await heartbeatFocusSession({
        client_session_id: current.clientSessionId,
        engine_state: current.engine as unknown as Record<string, unknown>,
        focus_seconds: Math.round(current.engine.totalFocusMs / 1000),
        break_seconds: Math.round(current.engine.totalBreakMs / 1000),
        expected_revision: Math.max(1, current.revision),
      });

      if (result.conflict && result.snapshot) {
        setSyncStatus("conflict");
        applySnapshot(result.snapshot);
        setSyncStatus("synced");
        return;
      }
      if (result.error && !result.conflict) {
        setSyncStatus(navigator.onLine ? "conflict" : "offline");
        return;
      }
      if (result.revision) {
        current.setRevisionFromServer(result.revision);
      }
      setSyncStatus("synced");
    } catch {
      setSyncStatus("offline");
    } finally {
      syncingRef.current = false;
    }
  }, [applySnapshot]);

  // Initial server hydrate — authoritative over localStorage.
  React.useEffect(() => {
    let cancelled = false;
    hydratedServerRef.current = false;

    async function hydrate() {
      setSyncStatus("syncing");
      try {
        const result = await fetchActiveFocusSession();
        if (cancelled) return;
        if (result.error) {
          setSyncStatus(navigator.onLine ? "idle" : "offline");
          hydratedServerRef.current = true;
          return;
        }

        const server = result.snapshot ?? null;
        const local = timerRef.current.readLocalBundle();
        const preferServer = shouldPreferServerOverLocal({
          server,
          localClientSessionId: local?.clientSessionId ?? null,
          localRevision: local?.revision ?? 0,
        });

        if (preferServer && server) {
          applySnapshot(server);
        }
        setSyncStatus(server ? "synced" : "idle");
      } catch {
        if (!cancelled) setSyncStatus("offline");
      } finally {
        if (!cancelled) hydratedServerRef.current = true;
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [userId, applySnapshot]);

  // Periodic heartbeat while active/finished (after server hydrate).
  // Finished pushes let other devices dismiss the mini-player once completion is persisted.
  React.useEffect(() => {
    if (!timer.clientSessionId) return;
    if (!active && !finished) return;
    if (!hydratedServerRef.current) return;

    const id = window.setInterval(() => {
      void pushSessionNow();
    }, 15_000);

    // Defer so setState inside pushSessionNow is not synchronous in this effect.
    const immediate = window.setTimeout(() => {
      void pushSessionNow();
    }, 0);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(immediate);
    };
  }, [
    timer.clientSessionId,
    active,
    finished,
    timer.engine.runState,
    timer.engine.phase,
    pushSessionNow,
  ]);

  // Supabase Realtime — other devices / tabs.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`focus-active-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "focus_active_sessions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (timerRef.current.isApplyingRemote() || syncingRef.current) return;

          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { client_session_id?: string } | null;
            if (
              oldRow?.client_session_id &&
              oldRow.client_session_id === timerRef.current.clientSessionId
            ) {
              // Own completion deletes the row — keep finished UI for the save dialog.
              if (timerRef.current.engine.runState === "finished") {
                setSyncStatus("idle");
                return;
              }
              timerRef.current.reset();
              timerRef.current.clearSession();
              setSyncStatus("idle");
            }
            return;
          }

          const row = payload.new as FocusActiveSession | undefined;
          if (!row?.client_session_id) return;
          const snapshot = snapshotFromActiveRow({
            ...row,
            revision: row.revision ?? 1,
          });
          if (!snapshot) return;

          const localRev = timerRef.current.revision;
          if (snapshot.revision <= localRev) return;

          applySnapshot(snapshot);
          setSyncStatus("synced");
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncStatus((prev) => (prev === "offline" ? "synced" : prev));
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, applySnapshot]);

  React.useEffect(() => {
    function onOnline() {
      setSyncStatus("syncing");
      void fetchActiveFocusSession().then((result) => {
        if (result.snapshot) {
          const local = timerRef.current.readLocalBundle();
          if (
            shouldPreferServerOverLocal({
              server: result.snapshot,
              localClientSessionId: local?.clientSessionId ?? null,
              localRevision: local?.revision ?? timerRef.current.revision,
            })
          ) {
            applySnapshot(result.snapshot);
          }
          setSyncStatus("synced");
        } else {
          setSyncStatus("idle");
        }
      });
    }
    function onOffline() {
      setSyncStatus("offline");
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [applySnapshot]);

  const hardReset = React.useCallback(() => {
    timerRef.current.reset();
    timerRef.current.clearSession();
    playerRef.current.stop();
    setSyncStatus("idle");
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
      syncStatus,
      setPrimary: (id) => setSoundscape((s) => ({ ...s, primary: id })),
      setSecondary: (id) => setSoundscape((s) => ({ ...s, secondary: id })),
      setVolume: (v) => setSoundscape((s) => ({ ...s, volume: v })),
      setSecondaryVolume: (v) =>
        setSoundscape((s) => ({ ...s, secondaryVolume: v })),
      hydrateFromPreferences,
      pushSessionNow,
      hardReset,
    }),
    [
      timer,
      player,
      soundscape,
      syncStatus,
      hydrateFromPreferences,
      pushSessionNow,
      hardReset,
    ],
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
