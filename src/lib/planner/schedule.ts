import {
  addLocalDays,
  localDateKey,
  weekdayKeyFromDateKey,
} from "@/lib/progress/timezone";
import type { Weekday } from "@/lib/subjects";
import {
  formatHHmm,
  parseHHmm,
  zonedDateTimeToUtcIso,
} from "@/lib/planner/zoned-time";
import type {
  BusyInterval,
  ProposedSession,
  SchedulingConfig,
  SubjectAllocation,
  TimeWindow,
} from "@/lib/planner/types";

export type ScheduleResult = {
  sessions: ProposedSession[];
  warnings: string[];
  unscheduled: { subjectId: string; remainingMinutes: number; reason: string }[];
  plannedMinutes: number;
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function busyOnDay(
  busy: BusyInterval[],
  dateKey: string,
  timeZone: string,
): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (const item of busy) {
    const start = new Date(item.startsAt);
    const end = new Date(item.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      continue;
    }
    // Expand to minutes overlapping this local day
    const dayStartIso = zonedDateTimeToUtcIso(dateKey, "00:00", timeZone);
    const nextDay = addLocalDays(dateKey, 1);
    const dayEndIso = zonedDateTimeToUtcIso(nextDay, "00:00", timeZone);
    const dayStart = new Date(dayStartIso).getTime();
    const dayEnd = new Date(dayEndIso).getTime();
    const clipStart = Math.max(start.getTime(), dayStart);
    const clipEnd = Math.min(end.getTime(), dayEnd);
    if (clipEnd <= clipStart) continue;

    // Convert clipped instants to local minutes
    const startKey = localDateKey(new Date(clipStart), timeZone);
    const endKey = localDateKey(new Date(clipEnd - 1), timeZone);
    if (startKey !== dateKey && endKey !== dateKey) continue;

    const startParts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(clipStart));
    const endParts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(Math.max(clipStart, clipEnd - 60_000)));
    const sH = Number(startParts.find((p) => p.type === "hour")?.value ?? 0);
    const sM = Number(startParts.find((p) => p.type === "minute")?.value ?? 0);
    const eH = Number(endParts.find((p) => p.type === "hour")?.value ?? 0);
    const eM = Number(endParts.find((p) => p.type === "minute")?.value ?? 0);
    const startMin = sH * 60 + sM;
    let endMin = eH * 60 + eM + 1;
    if (localDateKey(new Date(clipEnd), timeZone) !== dateKey) {
      endMin = 24 * 60;
    }
    if (endMin <= startMin) endMin = Math.min(24 * 60, startMin + 1);
    out.push({ start: startMin, end: endMin });
  }
  return out.sort((a, b) => a.start - b.start);
}

function freeSlots(
  windows: TimeWindow[],
  busyMinutes: { start: number; end: number }[],
  sessionMinutes: number,
): { start: number; end: number }[] {
  const slots: { start: number; end: number }[] = [];
  for (const window of windows) {
    let cursor = parseHHmm(window.start);
    const windowEnd = parseHHmm(window.end);
    if (windowEnd <= cursor) continue;

    const blocking = busyMinutes
      .filter((b) => overlaps(cursor, windowEnd, b.start, b.end))
      .sort((a, b) => a.start - b.start);

    for (const block of blocking) {
      if (block.start - cursor >= sessionMinutes) {
        slots.push({ start: cursor, end: block.start });
      }
      cursor = Math.max(cursor, block.end);
    }
    if (windowEnd - cursor >= sessionMinutes) {
      slots.push({ start: cursor, end: windowEnd });
    }
  }
  return slots;
}

function takeSessionFromSlots(
  slots: { start: number; end: number }[],
  sessionMinutes: number,
  breakMinutes: number,
): { start: number; end: number } | null {
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i]!;
    if (slot.end - slot.start < sessionMinutes) continue;
    const start = slot.start;
    const end = start + sessionMinutes;
    slot.start = end + breakMinutes;
    if (slot.start >= slot.end) slots.splice(i, 1);
    return { start, end };
  }
  return null;
}

let proposalId = 0;
export function resetProposalIds(seed = 0) {
  proposalId = seed;
}
function nextId() {
  proposalId += 1;
  return `ps_${proposalId}`;
}

/**
 * Deterministic scheduler: places highest-priority allocations first into
 * free availability windows, avoiding busy intervals and daily caps.
 */
export function buildSchedule(
  config: SchedulingConfig,
  allocations: SubjectAllocation[],
): ScheduleResult {
  const warnings: string[] = [];
  const sessions: ProposedSession[] = [];
  const unscheduled: ScheduleResult["unscheduled"] = [];
  const now = new Date(config.nowIso).getTime();
  const dailyUsed = new Map<string, number>();

  const sorted = allocations
    .slice()
    .filter((a) => a.suggestedMinutes > 0 && a.subjectId)
    .sort((a, b) => b.priority - a.priority || b.suggestedMinutes - a.suggestedMinutes);

  const remaining = new Map(
    sorted.map((a, index) => [
      `${a.subjectId}:${a.topicId ?? ""}:${a.kind}:${index}`,
      { ...a, remainingMinutes: a.suggestedMinutes },
    ]),
  );

  const days: string[] = [];
  for (
    let cursor = config.periodStart;
    cursor <= config.periodEnd;
    cursor = addLocalDays(cursor, 1)
  ) {
    days.push(cursor);
  }

  for (const dateKey of days) {
    const weekday = weekdayKeyFromDateKey(dateKey, config.timeZone) as Weekday;
    if (config.restDays.includes(weekday)) continue;
    if (!config.weekdayAvailability[weekday]) continue;

    const windows = config.timeWindows[weekday] ?? [];
    if (windows.length === 0) continue;

    const busy = busyOnDay(config.busy, dateKey, config.timeZone);
    let dayMinutes = dailyUsed.get(dateKey) ?? 0;
    const dayCap = Math.round(config.maxHoursPerDay * 60);

    // Round-robin through remaining allocations to spread subjects
    const keys = [...remaining.keys()];
    let progress = true;
    while (progress && dayMinutes + Math.min(config.sessionMinutes, 25) <= dayCap) {
      progress = false;
      for (const key of keys) {
        const item = remaining.get(key);
        if (!item || item.remainingMinutes <= 0) continue;
        if (item.beforeDate && dateKey > item.beforeDate) continue;

        const duration = Math.min(
          config.sessionMinutes,
          item.remainingMinutes,
          dayCap - dayMinutes,
        );
        if (duration < 25) continue;

        // Rebuild slots with current day busy including already placed sessions
        const placedBusy = sessions
          .filter((s) => s.date === dateKey)
          .map((s) => ({
            start: parseHHmm(s.startTime),
            end: parseHHmm(s.endTime),
          }));
        const daySlots = freeSlots(windows, [...busy, ...placedBusy], duration);
        const slot = takeSessionFromSlots(daySlots, duration, config.breakMinutes);
        if (!slot) continue;

        const startTime = formatHHmm(slot.start);
        const endTime = formatHHmm(slot.end);
        const startsAt = zonedDateTimeToUtcIso(dateKey, startTime, config.timeZone);
        if (new Date(startsAt).getTime() < now) continue;

        sessions.push({
          localId: nextId(),
          subjectId: item.subjectId,
          topicId: item.topicId,
          taskId: null,
          date: dateKey,
          startTime,
          endTime,
          durationMinutes: duration,
          goal:
            item.kind === "revision"
              ? `Revise: ${item.reason}`
              : item.reason.slice(0, 160),
          kind: item.kind,
          locked: false,
          selected: true,
        });

        item.remainingMinutes -= duration;
        dayMinutes += duration;
        dailyUsed.set(dateKey, dayMinutes);
        progress = true;

        if (dayMinutes + 25 > dayCap) break;
      }
    }
  }

  for (const item of remaining.values()) {
    if (item.remainingMinutes <= 0) continue;
    unscheduled.push({
      subjectId: item.subjectId,
      remainingMinutes: item.remainingMinutes,
      reason: `Could not fit ${item.remainingMinutes} min (${item.reason})`,
    });
  }

  if (unscheduled.length > 0) {
    warnings.push(
      `Not enough free time for ${unscheduled.length} allocation${unscheduled.length === 1 ? "" : "s"}. Reduce intensity, extend the period, or free calendar space.`,
    );
  }

  if (sessions.length === 0) {
    warnings.push("No sessions could be scheduled with the current availability and constraints.");
  }

  const plannedMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  return { sessions, warnings, unscheduled, plannedMinutes };
}

export function detectSessionConflicts(
  sessions: ProposedSession[],
  busy: BusyInterval[],
  timeZone: string,
): { localId: string; message: string }[] {
  const conflicts: { localId: string; message: string }[] = [];
  const sorted = sessions
    .filter((s) => s.selected)
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? parseHHmm(a.startTime) - parseHHmm(b.startTime)
        : a.date.localeCompare(b.date),
    );

  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i]!;
    const aStart = zonedDateTimeToUtcIso(a.date, a.startTime, timeZone);
    const aEnd = zonedDateTimeToUtcIso(a.date, a.endTime, timeZone);
    for (let j = i + 1; j < sorted.length; j += 1) {
      const b = sorted[j]!;
      if (a.date !== b.date) break;
      const bStart = zonedDateTimeToUtcIso(b.date, b.startTime, timeZone);
      const bEnd = zonedDateTimeToUtcIso(b.date, b.endTime, timeZone);
      if (
        overlaps(
          new Date(aStart).getTime(),
          new Date(aEnd).getTime(),
          new Date(bStart).getTime(),
          new Date(bEnd).getTime(),
        )
      ) {
        conflicts.push({
          localId: a.localId,
          message: `Overlaps another proposed session at ${b.startTime}`,
        });
      }
    }

    for (const item of busy) {
      if (
        overlaps(
          new Date(aStart).getTime(),
          new Date(aEnd).getTime(),
          new Date(item.startsAt).getTime(),
          new Date(item.endsAt).getTime(),
        )
      ) {
        conflicts.push({
          localId: a.localId,
          message: `Conflicts with existing calendar item${item.label ? `: ${item.label}` : ""}`,
        });
      }
    }
  }

  return conflicts;
}

export function intensityMultiplier(intensity: "light" | "balanced" | "intensive") {
  if (intensity === "light") return 0.6;
  if (intensity === "intensive") return 1.25;
  return 1;
}
