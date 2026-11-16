import type {
  ExternalCalendar,
  ExternalCalendarDestination,
  ExternalCalendarEvent,
  ExternalEventShowAs,
} from "@/lib/calendar-sync/types";
import { showAsBlocksStudy } from "@/lib/calendar-sync/busy";

export type { ExternalCalendarDestination };

/** Where an enabled external calendar’s events appear in Studi Calendar. */
export const EXTERNAL_CALENDAR_DESTINATIONS = [
  "exams",
  "deadlines",
  "tasks",
  "personal",
  "external",
] as const satisfies readonly ExternalCalendarDestination[];

export const EXTERNAL_CALENDAR_DESTINATION_LABELS: Record<
  ExternalCalendarDestination,
  string
> = {
  exams: "Exams",
  deadlines: "Deadlines",
  tasks: "Tasks",
  personal: "Personal",
  external: "External",
};

/** Safe defaults for newly discovered / imported calendars. */
export const DEFAULT_EXTERNAL_CALENDAR_DESTINATION: ExternalCalendarDestination =
  "external";
export const DEFAULT_EXTERNAL_CALENDAR_BLOCKS_STUDY = true;

export function isExternalCalendarDestination(
  value: unknown,
): value is ExternalCalendarDestination {
  return (
    typeof value === "string" &&
    (EXTERNAL_CALENDAR_DESTINATIONS as readonly string[]).includes(value)
  );
}

export function normalizeExternalCalendarDestination(
  value: unknown,
): ExternalCalendarDestination {
  return isExternalCalendarDestination(value)
    ? value
    : DEFAULT_EXTERNAL_CALENDAR_DESTINATION;
}

export type ExternalCalendarVisibility = Pick<
  ExternalCalendar,
  "id" | "enabled" | "blocks_study" | "studi_destination"
>;

/** Disabled calendars never appear in Calendar, suggestions, or planner. */
export function isExternalCalendarVisible(
  calendar: Pick<ExternalCalendar, "enabled"> | null | undefined,
): boolean {
  return Boolean(calendar?.enabled);
}

/**
 * Block study time requires both: calendar enabled AND blocks_study on.
 * Disabled calendars never block, regardless of a stale blocks_study value.
 */
export function doesExternalCalendarBlockStudy(
  calendar:
    | Pick<ExternalCalendar, "enabled" | "blocks_study">
    | null
    | undefined,
): boolean {
  return Boolean(calendar?.enabled && calendar.blocks_study);
}

export function filterVisibleExternalEvents<
  T extends Pick<ExternalCalendarEvent, "calendar_id" | "is_cancelled">,
>(
  events: readonly T[],
  calendars: readonly Pick<ExternalCalendar, "id" | "enabled">[],
): T[] {
  const byId = new Map(calendars.map((c) => [c.id, c]));
  return events.filter((event) => {
    if (event.is_cancelled) return false;
    const cal = byId.get(event.calendar_id);
    // Unknown calendar: hide (fail closed) once settings exist.
    return isExternalCalendarVisible(cal);
  });
}

export function eventEligibleToBlockStudy(
  event: Pick<ExternalCalendarEvent, "show_as" | "is_cancelled" | "calendar_id">,
  calendar:
    | Pick<ExternalCalendar, "enabled" | "blocks_study">
    | null
    | undefined,
): boolean {
  if (event.is_cancelled) return false;
  if (!doesExternalCalendarBlockStudy(calendar)) return false;
  return showAsBlocksStudy(event.show_as as ExternalEventShowAs);
}

export function filterBlockingExternalEvents<
  T extends Pick<
    ExternalCalendarEvent,
    "calendar_id" | "is_cancelled" | "show_as"
  >,
>(
  events: readonly T[],
  calendars: readonly Pick<
    ExternalCalendar,
    "id" | "enabled" | "blocks_study"
  >[],
): T[] {
  const byId = new Map(calendars.map((c) => [c.id, c]));
  return events.filter((event) =>
    eventEligibleToBlockStudy(event, byId.get(event.calendar_id)),
  );
}

/**
 * Toggle helper used by tests and UI logic: enabled → disabled → enabled
 * must restore prior destination/blocks_study without resetting them.
 */
export function applyCalendarEnabledToggle<
  T extends { enabled: boolean; studi_destination: ExternalCalendarDestination; blocks_study: boolean },
>(calendar: T, enabled: boolean): T {
  return { ...calendar, enabled };
}

export function applyCalendarDestination<
  T extends { studi_destination: ExternalCalendarDestination },
>(calendar: T, destination: ExternalCalendarDestination): T {
  return { ...calendar, studi_destination: destination };
}

export function applyCalendarBlocksStudy<
  T extends { blocks_study: boolean },
>(calendar: T, blocksStudy: boolean): T {
  return { ...calendar, blocks_study: blocksStudy };
}

/**
 * Migration/backfill semantics for existing production rows:
 * keep enabled as-is; destination external; blocks_study true.
 */
export function migratedExternalCalendarDefaults(input: {
  enabled: boolean;
}): {
  enabled: boolean;
  studi_destination: ExternalCalendarDestination;
  blocks_study: boolean;
} {
  return {
    enabled: input.enabled,
    studi_destination: DEFAULT_EXTERNAL_CALENDAR_DESTINATION,
    blocks_study: DEFAULT_EXTERNAL_CALENDAR_BLOCKS_STUDY,
  };
}
