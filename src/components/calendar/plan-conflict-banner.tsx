"use client";

import Link from "next/link";

import type { PlanConflict } from "@/lib/calendar-sync/busy";

/**
 * Surfaces conflicts between planned study sessions and newly synced busy
 * external events. Does not silently reschedule — offers regenerate via Planner.
 */
export function PlanConflictBanner({ conflicts }: { conflicts: PlanConflict[] }) {
  if (conflicts.length === 0) return null;
  const sample = conflicts.slice(0, 3);
  return (
    <div
      role="status"
      className="mb-3 rounded-[16px] border border-hairline bg-sunken px-4 py-3 text-[13.5px] text-ink"
    >
      <p className="font-semibold">
        {conflicts.length} study session
        {conflicts.length === 1 ? "" : "s"} conflict
        {conflicts.length === 1 ? "s" : ""} with your connected calendar
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
        {sample.map((c) => (
          <li key={`${c.sessionId}:${c.eventId}`}>
            Session overlaps “{c.eventTitle}”
          </li>
        ))}
        {conflicts.length > 3 ? (
          <li>…and {conflicts.length - 3} more</li>
        ) : null}
      </ul>
      <p className="mt-2 text-ink-2">
        Studi will not change your plan automatically.{" "}
        <Link
          href="/planner"
          className="font-semibold text-accent-ink underline-offset-2 hover:underline"
        >
          Open Study Planner
        </Link>{" "}
        to regenerate or reschedule affected sessions.
      </p>
    </div>
  );
}
