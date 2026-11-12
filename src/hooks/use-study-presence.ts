"use client";

import { useEffect, useRef } from "react";

import { clearPresence, upsertPresence } from "@/actions/presence";
import type { PresenceStatus } from "@/lib/social";

/**
 * Publishes low-frequency study presence while Focus Mode is active.
 * Heartbeats every ~60s — never per-second. Clears on unmount.
 */
export function useStudyPresence(input: {
  enabled: boolean;
  status: PresenceStatus;
  activityLabel?: string | null;
}) {
  const lastStatus = useRef<string>("");
  const { enabled, status, activityLabel } = input;

  useEffect(() => {
    if (!enabled) {
      if (lastStatus.current && lastStatus.current !== "offline") {
        lastStatus.current = "offline";
        void clearPresence();
      }
      return;
    }

    const key = `${status}:${activityLabel ?? ""}`;
    if (key !== lastStatus.current) {
      lastStatus.current = key;
      void upsertPresence({
        status,
        activity_label: activityLabel ?? null,
      });
    }

    const id = window.setInterval(() => {
      void upsertPresence({
        status,
        activity_label: activityLabel ?? null,
      });
    }, 60_000);

    return () => {
      window.clearInterval(id);
    };
  }, [enabled, status, activityLabel]);

  useEffect(() => {
    return () => {
      lastStatus.current = "offline";
      void clearPresence();
    };
  }, []);
}
