"use client";

import { useMemo, useRef, useState } from "react";

import {
  browserTimeZone,
  endAfterStartError,
  isPastCalendarEvent,
  shiftEndPreservingDuration,
} from "@/lib/event-time";

export function useTimedRange(initial: { date: string; start: string; end: string }) {
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const endTouched = useRef(false);
  const timeZone = useMemo(() => browserTimeZone(), []);

  const changeStart = (value: string) => {
    setStart((prev) => {
      if (!endTouched.current && prev && value && prev !== value) {
        setEnd((current) => shiftEndPreservingDuration(prev, value, current));
      }
      return value;
    });
  };

  const changeEnd = (value: string) => {
    endTouched.current = true;
    setEnd(value);
  };

  return {
    date,
    setDate,
    start,
    end,
    changeStart,
    changeEnd,
    timeZone,
    past: (allDay: boolean) =>
      isPastCalendarEvent({
        date,
        startTime: start,
        allDay,
        timeZone,
      }),
    orderError: (required: boolean) => endAfterStartError(start, end, required),
  };
}

export function PastEventNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p
      role="status"
      className="rounded-[var(--radius-sm)] bg-sunken px-3 py-2 text-[13px] text-ink-2"
    >
      This is in the past. You can still save it.
    </p>
  );
}
