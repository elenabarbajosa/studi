import { localDateKey } from "@/lib/progress/timezone";

/**
 * Convert a local calendar date + HH:mm in `timeZone` to a UTC ISO string.
 * DST-safe via binary search on the timezone offset.
 */
export function zonedDateTimeToUtcIso(
  dateKey: string,
  timeHHmm: string,
  timeZone: string,
): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = timeHHmm.split(":").map(Number);
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) {
    throw new Error("Invalid date or time");
  }

  const targetMinutes = hh * 60 + mm;
  let lo = Date.UTC(y, m - 1, d) - 14 * 3600_000;
  let hi = Date.UTC(y, m - 1, d) + 38 * 3600_000;

  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    const instant = new Date(mid);
    const key = localDateKey(instant, timeZone);
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const minutes = hour * 60 + minute;

    if (key < dateKey || (key === dateKey && minutes < targetMinutes)) lo = mid;
    else hi = mid;
  }

  return new Date(hi).toISOString();
}

export function utcIsoToLocalTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function parseHHmm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function formatHHmm(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
