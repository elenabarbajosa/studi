"use client";

import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Calls `save` whenever `payload` changes after the
 * initial mount. Status resets to idle a few seconds after a successful save.
 */
export function useAutosave<T>(
  payload: T,
  save: (payload: T) => Promise<{ error?: string } | void>,
  options?: { delayMs?: number; enabled?: boolean },
) {
  const delayMs = options?.delayMs ?? 600;
  const enabled = options?.enabled ?? true;
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const ready = useRef(false);
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serial = useRef(JSON.stringify(payload));

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!enabled) return;
    const next = JSON.stringify(payload);
    if (!ready.current) {
      ready.current = true;
      serial.current = next;
      return;
    }
    if (next === serial.current) return;
    serial.current = next;

    if (timer.current) clearTimeout(timer.current);
    if (idleTimer.current) clearTimeout(idleTimer.current);

    timer.current = setTimeout(() => {
      setStatus("saving");
      setError(null);
      void (async () => {
        const result = await saveRef.current(payload);
        if (result && "error" in result && result.error) {
          setStatus("error");
          setError(result.error);
          return;
        }
        setStatus("saved");
        idleTimer.current = setTimeout(() => setStatus("idle"), 2200);
      })();
    }, delayMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [payload, delayMs, enabled]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    [],
  );

  return { status, error };
}
