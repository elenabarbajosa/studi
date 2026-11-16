"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import type { FocusTimerMode } from "@/lib/calendar";
import {
  restoreEngineFromAuthoritative,
  type FocusSessionSnapshot,
} from "@/lib/focus/session-sync";
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
  revision?: number;
  /** Owner of the persisted session — ignore restore across account switches. */
  userId?: string;
};

function readStoredBundle(userId?: string | null): StoredBundle | null {
  try {
    const raw = window.localStorage.getItem(FOCUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBundle;
    if (!parsed?.engine || !parsed.clientSessionId) return null;
    if (userId && parsed.userId !== userId) {
      window.localStorage.removeItem(FOCUS_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useFocusTimer(
  initialConfig: FocusConfig,
  options?: { userId?: string | null },
) {
  const userId = options?.userId ?? null;
  const [config, setConfig] = useState(initialConfig);
  const configRef = useRef(config);
  const [engine, setEngine] = useState<FocusEngineState>(() =>
    createEngine("pomodoro", initialConfig),
  );
  const engineRef = useRef(engine);
  const [now, setNow] = useState(0);
  const [clientSessionId, setClientSessionId] = useState<string | null>(null);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [revision, setRevision] = useState(0);
  const lastKnownRef = useRef(0);
  const onPhaseCompleteRef = useRef<((phase: string) => void) | null>(null);
  const didRestoreRef = useRef(false);
  const clientSessionIdRef = useRef<string | null>(null);
  const metaRef = useRef<SessionMeta | null>(null);
  const revisionRef = useRef(0);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  useEffect(() => {
    clientSessionIdRef.current = clientSessionId;
  }, [clientSessionId]);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);

  const writeBundle = useCallback(
    (
      next: FocusEngineState,
      sessionId: string | null,
      m: SessionMeta | null,
      rev: number,
      lastKnownAt: number,
    ) => {
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
        lastKnownAt,
        clientSessionId: sessionId,
        meta: m,
        revision: rev,
        ...(userId ? { userId } : {}),
      };
      try {
        window.localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(bundle));
      } catch {
        /* ignore */
      }
    },
    [userId],
  );

  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    const stored = readStoredBundle(userId);
    const t = Date.now();
    startTransition(() => {
      setNow(t);
      lastKnownRef.current = t;
      if (!stored) return;
      // Local cache only — server hydrate in FocusSessionProvider may replace this.
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
      setRevision(stored.revision ?? 0);
      lastKnownRef.current = stored.lastKnownAt;
    });
  }, [userId]);

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
        // Always refresh lastKnownAt in localStorage while a session is live,
        // even when the engine object identity does not change mid-countdown.
        writeBundle(
          result.state,
          clientSessionIdRef.current,
          metaRef.current,
          revisionRef.current,
          t,
        );
        return result.state;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [writeBundle]);

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
        writeBundle(
          recovered,
          clientSessionIdRef.current,
          metaRef.current,
          revisionRef.current,
          t,
        );
        return recovered;
      });
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [writeBundle]);

  useEffect(() => {
    writeBundle(engine, clientSessionId, meta, revision, Date.now());
  }, [engine, clientSessionId, meta, revision, writeBundle]);

  const applyConfig = useCallback((patch: Partial<FocusConfig>) => {
    if (engineRef.current.runState !== "idle") return;
    const nextConfig = { ...configRef.current, ...patch };
    const nextEngine = createEngine(engineRef.current.mode, nextConfig);
    configRef.current = nextConfig;
    engineRef.current = nextEngine;
    setConfig(nextConfig);
    setEngine(nextEngine);
  }, []);

  const switchMode = useCallback(
    (mode: FocusTimerMode) => {
      if (engine.runState === "running" || engine.runState === "paused") return;
      setEngine(createEngine(mode, configRef.current));
      setClientSessionId(null);
      setMeta(null);
      setRevision(0);
    },
    [engine.runState],
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
      const next = start(createEngine(engine.mode, configRef.current), t);
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
      setRevision(1);
      setNow(t);
      lastKnownRef.current = t;
      return { engine: next, meta: m, startedAt: t };
    },
    [engine.mode],
  );

  const hydrateFromSnapshot = useCallback((snapshot: FocusSessionSnapshot) => {
    applyingRemoteRef.current = true;
    const t = Date.now();
    const heartbeatMs = Date.parse(snapshot.lastHeartbeatAt) || t;
    const restored = restoreEngineFromAuthoritative({
      engine: snapshot.engine,
      nowMs: t,
      lastHeartbeatAtMs: heartbeatMs,
    });
    const m: SessionMeta = {
      subjectId: snapshot.subjectId,
      topicId: snapshot.topicId,
      taskId: snapshot.taskId,
      goal: snapshot.goal,
      startedAtIso: snapshot.startedAtIso,
    };
    configRef.current = {
      ...configRef.current,
      focusMinutes: restored.focusMinutes,
      shortBreakMinutes: restored.shortBreakMinutes,
      longBreakMinutes: restored.longBreakMinutes,
      intervalsBeforeLong: restored.intervalsBeforeLong,
      autoStartBreaks: restored.autoStartBreaks,
    };
    setConfig(configRef.current);
    setEngine(restored);
    setClientSessionId(snapshot.clientSessionId);
    setMeta(m);
    setRevision(snapshot.revision);
    setNow(t);
    lastKnownRef.current = t;
    writeBundle(restored, snapshot.clientSessionId, m, snapshot.revision, t);
    queueMicrotask(() => {
      applyingRemoteRef.current = false;
    });
  }, [writeBundle]);

  const setRevisionFromServer = useCallback((rev: number) => {
    setRevision(rev);
    revisionRef.current = rev;
  }, []);

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
    setEngine(createEngine(engine.mode, configRef.current));
    setClientSessionId(null);
    setMeta(null);
    setRevision(0);
    try {
      window.localStorage.removeItem(FOCUS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [engine.mode]);

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
    revision,
    display: formatTimer(displayMs(engine, now)),
    displayMs: displayMs(engine, now),
    remaining: remainingMs(engine, now),
    progress: progress01(engine, now),
    applyConfig,
    switchMode,
    begin,
    pause: doPause,
    resume: doResume,
    reset: doReset,
    finish: doFinish,
    hydrateFromSnapshot,
    setRevisionFromServer,
    isApplyingRemote: () => applyingRemoteRef.current,
    setOnPhaseComplete: (fn: ((phase: string) => void) | null) => {
      onPhaseCompleteRef.current = fn;
    },
    clearSession: () => {
      setClientSessionId(null);
      setMeta(null);
      setRevision(0);
      try {
        window.localStorage.removeItem(FOCUS_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
    readLocalBundle: () => readStoredBundle(userId),
  };
}
