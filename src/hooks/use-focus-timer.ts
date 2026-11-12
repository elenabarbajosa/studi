"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import type { FocusTimerMode } from "@/lib/calendar";
import {
  createEngine,
  displayMs,
  finish,
  formatTimer,
  pause,
  progress01,
  recoverAfterGap,
  remainingMs,
  resume,
  start,
  tick,
} from "@/lib/focus/timer-engine";
import type { FocusConfig, FocusEngineState } from "@/lib/focus/types";
import { FOCUS_HEARTBEAT_STALE_MS, FOCUS_STORAGE_KEY } from "@/lib/focus/types";

type SessionMeta = {
  subjectId: string | null;
  topicId: string | null;
  taskId: string | null;
  goal: string;
  startedAtIso: string;
};

type StoredBundle = {
  engine: FocusEngineState;
  lastKnownAt: number;
  clientSessionId: string;
  meta: SessionMeta;
};

function readStoredBundle(): StoredBundle | null {
  try {
    const raw = window.localStorage.getItem(FOCUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBundle;
    if (!parsed?.engine || !parsed.clientSessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useFocusTimer(initialConfig: FocusConfig) {
  const [config] = useState(initialConfig);
  const [engine, setEngine] = useState<FocusEngineState>(() =>
    createEngine("pomodoro", initialConfig),
  );
  const [now, setNow] = useState(0);
  const [clientSessionId, setClientSessionId] = useState<string | null>(null);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const lastKnownRef = useRef(0);
  const onPhaseCompleteRef = useRef<((phase: string) => void) | null>(null);
  const didRestoreRef = useRef(false);

  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    const stored = readStoredBundle();
    const t = Date.now();
    startTransition(() => {
      setNow(t);
      lastKnownRef.current = t;
      if (!stored) return;
      setEngine(
        recoverAfterGap(
          stored.engine,
          t,
          stored.lastKnownAt,
          FOCUS_HEARTBEAT_STALE_MS,
        ),
      );
      setClientSessionId(stored.clientSessionId);
      setMeta(stored.meta);
    });
  }, []);

  const persist = useCallback(
    (next: FocusEngineState, sessionId: string | null, m: SessionMeta | null) => {
      if (!sessionId || !m) {
        try {
          window.localStorage.removeItem(FOCUS_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        return;
      }
      const bundle: StoredBundle = {
        engine: next,
        lastKnownAt: Date.now(),
        clientSessionId: sessionId,
        meta: m,
      };
      try {
        window.localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(bundle));
      } catch {
        /* ignore */
      }
    },
    [],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setEngine((prev) => {
        const result = tick(prev, t);
        if (result.phaseCompleted && result.completedPhase) {
          onPhaseCompleteRef.current?.(result.completedPhase);
        }
        lastKnownRef.current = t;
        return result.state;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== "visible") return;
      const t = Date.now();
      setNow(t);
      setEngine((prev) => {
        const recovered = recoverAfterGap(
          prev,
          t,
          lastKnownRef.current || t,
          FOCUS_HEARTBEAT_STALE_MS,
        );
        lastKnownRef.current = t;
        return recovered;
      });
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  useEffect(() => {
    persist(engine, clientSessionId, meta);
  }, [engine, clientSessionId, meta, persist]);

  const switchMode = useCallback(
    (mode: FocusTimerMode) => {
      if (engine.runState === "running" || engine.runState === "paused") return;
      setEngine(createEngine(mode, config));
      setClientSessionId(null);
      setMeta(null);
    },
    [config, engine.runState],
  );

  const begin = useCallback(
    (opts: {
      subjectId: string | null;
      topicId: string | null;
      taskId: string | null;
      goal: string;
      clientSessionId: string;
    }) => {
      const t = Date.now();
      const next = start(createEngine(engine.mode, config), t);
      const m: SessionMeta = {
        subjectId: opts.subjectId,
        topicId: opts.topicId,
        taskId: opts.taskId,
        goal: opts.goal,
        startedAtIso: new Date(t).toISOString(),
      };
      setEngine(next);
      setClientSessionId(opts.clientSessionId);
      setMeta(m);
      setNow(t);
      lastKnownRef.current = t;
      return { engine: next, meta: m, startedAt: t };
    },
    [config, engine.mode],
  );

  const doPause = useCallback(() => {
    const t = Date.now();
    setEngine((prev) => pause(prev, t));
    setNow(t);
    lastKnownRef.current = t;
  }, []);

  const doResume = useCallback(() => {
    const t = Date.now();
    setEngine((prev) => resume(prev, t));
    setNow(t);
    lastKnownRef.current = t;
  }, []);

  const doReset = useCallback(() => {
    setEngine(createEngine(engine.mode, config));
    setClientSessionId(null);
    setMeta(null);
    try {
      window.localStorage.removeItem(FOCUS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [config, engine.mode]);

  const doFinish = useCallback(() => {
    const t = Date.now();
    const next = finish(engine, t);
    setEngine(next);
    setNow(t);
    lastKnownRef.current = t;
    return next;
  }, [engine]);

  return {
    engine,
    config,
    now,
    clientSessionId,
    meta,
    display: formatTimer(displayMs(engine, now)),
    displayMs: displayMs(engine, now),
    remaining: remainingMs(engine, now),
    progress: progress01(engine, now),
    switchMode,
    begin,
    pause: doPause,
    resume: doResume,
    reset: doReset,
    finish: doFinish,
    setOnPhaseComplete: (fn: ((phase: string) => void) | null) => {
      onPhaseCompleteRef.current = fn;
    },
    clearSession: () => {
      setClientSessionId(null);
      setMeta(null);
      try {
        window.localStorage.removeItem(FOCUS_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
