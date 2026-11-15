import type { BusyInterval } from "@/lib/planner/types";
import type {
  ExternalCalendarEvent,
  ExternalEventShowAs,
} from "@/lib/calendar-sync/types";
import { DEFAULT_SHOW_AS } from "@/lib/calendar-sync/types";
import { dedupeFingerprint } from "@/lib/calendar-sync/hash";

/**
 * Free/Busy mapping for the Study Planner:
 * - free → does not block
 * - busy | tentative | oof → blocks
 * - unknown → blocks (DEFAULT_SHOW_AS = busy); users can override by disabling
 *   the calendar or marking the event free at the source.
 */
export function showAsBlocksStudy(showAs: ExternalEventShowAs): boolean {
  if (showAs === "free") return false;
  if (showAs === "unknown") return DEFAULT_SHOW_AS !== "free";
  return true;
}

export function externalEventToBusy(
  event: Pick<
    ExternalCalendarEvent,
    | "title"
    | "starts_at"
    | "ends_at"
    | "show_as"
    | "is_cancelled"
    | "ical_uid"
  >,
): BusyInterval | null {
  if (event.is_cancelled) return null;
  if (!showAsBlocksStudy(event.show_as)) return null;
  const endsAt = event.ends_at ?? event.starts_at;
  if (new Date(endsAt).getTime() <= new Date(event.starts_at).getTime()) {
    // Point events: block a minimal 1-minute window so they appear as busy.
    const start = new Date(event.starts_at).getTime();
    return {
      startsAt: event.starts_at,
      endsAt: new Date(start + 60_000).toISOString(),
      label: event.title || "External event",
    };
  }
  return {
    startsAt: event.starts_at,
    endsAt,
    label: event.title || "External event",
  };
}

/**
 * Merge busy intervals and drop duplicates when the same event is mirrored
 * through multiple providers (matching iCal UID + time, or title+time).
 */
export function mergeBusyIntervals(
  intervals: readonly BusyInterval[],
  externalEvents: readonly Pick<
    ExternalCalendarEvent,
    "title" | "starts_at" | "ends_at" | "show_as" | "is_cancelled" | "ical_uid"
  >[],
): BusyInterval[] {
  const seen = new Set<string>();
  const out: BusyInterval[] = [...intervals];

  for (const event of externalEvents) {
    const busy = externalEventToBusy(event);
    if (!busy) continue;
    const fp = dedupeFingerprint({
      icalUid: event.ical_uid,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
    });
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(busy);
  }

  return mergeOverlapping(out);
}

function mergeOverlapping(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length <= 1) return [...intervals];
  const sorted = [...intervals].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const merged: BusyInterval[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...cur });
      continue;
    }
    const lastEnd = new Date(last.endsAt).getTime();
    const curStart = new Date(cur.startsAt).getTime();
    if (curStart <= lastEnd) {
      const curEnd = new Date(cur.endsAt).getTime();
      if (curEnd > lastEnd) last.endsAt = cur.endsAt;
      if (cur.label && last.label !== cur.label) {
        last.label = last.label ? `${last.label}; ${cur.label}` : cur.label;
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export type PlanConflict = {
  sessionId: string;
  sessionStartsAt: string;
  sessionEndsAt: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt: string;
};

/** Detect overlaps between planned study sessions and busy external events. */
export function detectExternalPlanConflicts(
  sessions: readonly {
    id: string;
    starts_at: string;
    ends_at: string | null;
    status: string;
  }[],
  externalEvents: readonly Pick<
    ExternalCalendarEvent,
    "id" | "title" | "starts_at" | "ends_at" | "show_as" | "is_cancelled" | "ical_uid"
  >[],
): PlanConflict[] {
  const conflicts: PlanConflict[] = [];
  const busyEvents = externalEvents.filter(
    (e) => !e.is_cancelled && showAsBlocksStudy(e.show_as),
  );

  for (const session of sessions) {
    if (session.status !== "planned" || !session.ends_at) continue;
    const s0 = new Date(session.starts_at).getTime();
    const s1 = new Date(session.ends_at).getTime();
    for (const event of busyEvents) {
      const e0 = new Date(event.starts_at).getTime();
      const e1 = new Date(event.ends_at ?? event.starts_at).getTime();
      if (s0 < e1 && e0 < s1) {
        conflicts.push({
          sessionId: session.id,
          sessionStartsAt: session.starts_at,
          sessionEndsAt: session.ends_at,
          eventId: event.id,
          eventTitle: event.title || "External event",
          eventStartsAt: event.starts_at,
          eventEndsAt: event.ends_at ?? event.starts_at,
        });
      }
    }
  }
  return conflicts;
}
