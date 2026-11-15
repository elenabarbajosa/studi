import type { ProviderEvent } from "@/lib/calendar-sync/types";
import { DEFAULT_SHOW_AS } from "@/lib/calendar-sync/types";
import { ICS_MAX_BYTES, ICS_MAX_EVENTS } from "@/lib/calendar-sync/config";

export type IcsParseError = { code: string; message: string };

export type IcsParseResult =
  | { ok: true; events: ProviderEvent[]; truncated: boolean }
  | { ok: false; error: IcsParseError };

type RawProp = { name: string; params: Record<string, string>; value: string };

function unfold(ics: string): string[] {
  const normalized = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseLine(line: string): RawProp | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(";");
  const name = parts[0]?.toUpperCase() ?? "";
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name, params, value };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseDateValue(
  value: string,
  params: Record<string, string>,
): { iso: string; allDay: boolean; floating: boolean } | null {
  const raw = value.trim();
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    // All-day: store as UTC midnight of that civil date (Studi convention for display).
    return {
      iso: `${y}-${m}-${d}T00:00:00.000Z`,
      allDay: true,
      floating: false,
    };
  }
  const m = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/,
  );
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (z === "Z") {
    return {
      iso: `${y}-${mo}-${d}T${hh}:${mm}:${ss}.000Z`,
      allDay: false,
      floating: false,
    };
  }
  // Floating local time — treat as UTC wall clock with timezone param if present.
  const tz = params.TZID;
  if (tz) {
    // Keep as ISO-like local; callers store timezone separately.
    return {
      iso: `${y}-${mo}-${d}T${hh}:${mm}:${ss}.000Z`,
      allDay: false,
      floating: true,
    };
  }
  return {
    iso: `${y}-${mo}-${d}T${hh}:${mm}:${ss}.000Z`,
    allDay: false,
    floating: true,
  };
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

type Veotent = {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  dtstart?: { iso: string; allDay: boolean; floating: boolean; tzid?: string };
  dtend?: { iso: string; allDay: boolean; floating: boolean; tzid?: string };
  durationDays?: number;
  rrule?: string;
  exdates: string[];
  recurrenceId?: string;
  status?: string;
  sequence?: string;
};

function parseVevents(lines: string[]): Veotent[] {
  const events: Veotent[] = [];
  let cur: Veotent | null = null;
  for (const line of lines) {
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === "BEGIN" && prop.value.toUpperCase() === "VEVENT") {
      cur = { exdates: [] };
      continue;
    }
    if (prop.name === "END" && prop.value.toUpperCase() === "VEVENT") {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    switch (prop.name) {
      case "UID":
        cur.uid = prop.value;
        break;
      case "SUMMARY":
        cur.summary = unescapeText(prop.value);
        break;
      case "DESCRIPTION":
        cur.description = unescapeText(prop.value);
        break;
      case "LOCATION":
        cur.location = unescapeText(prop.value);
        break;
      case "STATUS":
        cur.status = prop.value.toUpperCase();
        break;
      case "RRULE":
        cur.rrule = prop.value;
        break;
      case "RECURRENCE-ID": {
        const parsed = parseDateValue(prop.value, prop.params);
        cur.recurrenceId = parsed?.iso ?? prop.value;
        break;
      }
      case "EXDATE": {
        for (const part of prop.value.split(",")) {
          const parsed = parseDateValue(part.trim(), prop.params);
          if (parsed) cur.exdates.push(parsed.iso);
        }
        break;
      }
      case "DTSTART": {
        const parsed = parseDateValue(prop.value, prop.params);
        if (parsed) {
          cur.dtstart = { ...parsed, tzid: prop.params.TZID };
        }
        break;
      }
      case "DTEND": {
        const parsed = parseDateValue(prop.value, prop.params);
        if (parsed) {
          cur.dtend = { ...parsed, tzid: prop.params.TZID };
        }
        break;
      }
      case "DURATION": {
        const dayMatch = prop.value.match(/P(?:(\d+)D)?/i);
        if (dayMatch?.[1]) cur.durationDays = Number(dayMatch[1]);
        break;
      }
      default:
        break;
    }
  }
  return events;
}

/** Expand a limited set of RRULE frequencies for import preview (bounded). */
function expandRrule(
  base: Veotent,
  windowEnd: Date,
  maxInstances: number,
): Array<{ startsAt: string; endsAt: string | null; recurrenceId?: string }> {
  if (!base.dtstart || !base.rrule) {
    return [
      {
        startsAt: base.dtstart!.iso,
        endsAt: base.dtend?.iso ?? null,
      },
    ];
  }

  const parts = Object.fromEntries(
    base.rrule.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k.toUpperCase(), v ?? ""];
    }),
  );
  const freq = (parts.FREQ ?? "").toUpperCase();
  const interval = Math.max(1, Number(parts.INTERVAL ?? "1") || 1);
  const count = parts.COUNT ? Math.min(Number(parts.COUNT), maxInstances) : maxInstances;
  const until = parts.UNTIL
    ? parseDateValue(parts.UNTIL, {})?.iso
    : null;
  const untilMs = until ? new Date(until).getTime() : windowEnd.getTime();
  const ex = new Set(base.exdates);

  const durationMs =
    base.dtend && base.dtstart
      ? new Date(base.dtend.iso).getTime() - new Date(base.dtstart.iso).getTime()
      : base.dtstart.allDay
        ? 24 * 60 * 60 * 1000 * (base.durationDays ?? 1)
        : 60 * 60 * 1000;

  const out: Array<{ startsAt: string; endsAt: string | null; recurrenceId?: string }> =
    [];
  const cursor = new Date(base.dtstart.iso);
  let n = 0;
  while (n < count && cursor.getTime() <= untilMs && out.length < maxInstances) {
    const startsAt = cursor.toISOString();
    if (!ex.has(startsAt) && !ex.has(startsAt.slice(0, 10) + "T00:00:00.000Z")) {
      const endsAt = new Date(cursor.getTime() + durationMs).toISOString();
      out.push({
        startsAt,
        endsAt,
        recurrenceId: n === 0 ? undefined : startsAt,
      });
    }
    n += 1;
    if (freq === "DAILY") cursor.setUTCDate(cursor.getUTCDate() + interval);
    else if (freq === "WEEKLY") cursor.setUTCDate(cursor.getUTCDate() + 7 * interval);
    else if (freq === "MONTHLY") cursor.setUTCMonth(cursor.getUTCMonth() + interval);
    else if (freq === "YEARLY") cursor.setUTCFullYear(cursor.getUTCFullYear() + interval);
    else break; // unsupported freq — keep master only
  }
  return out;
}

export function parseIcs(input: string | Buffer): IcsParseResult {
  const text =
    typeof input === "string" ? input : input.toString("utf8");
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > ICS_MAX_BYTES) {
    return {
      ok: false,
      error: {
        code: "too_large",
        message: `ICS file exceeds the ${ICS_MAX_BYTES / (1024 * 1024)} MB limit.`,
      },
    };
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    return {
      ok: false,
      error: {
        code: "invalid",
        message: "File does not look like a valid iCalendar (.ics).",
      },
    };
  }

  const lines = unfold(text);
  const vevents = parseVevents(lines);
  if (vevents.length === 0) {
    return {
      ok: false,
      error: {
        code: "empty",
        message: "No events found in this calendar file.",
      },
    };
  }

  const windowEnd = new Date();
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 180);
  const events: ProviderEvent[] = [];
  let truncated = false;

  // Apply exception overrides (RECURRENCE-ID) after expanding masters.
  const exceptions = vevents.filter((v) => v.recurrenceId);
  const masters = vevents.filter((v) => !v.recurrenceId);

  for (const master of masters) {
    if (!master.dtstart) continue;
    const instances = master.rrule
      ? expandRrule(master, windowEnd, 366)
      : [
          {
            startsAt: master.dtstart.iso,
            endsAt:
              master.dtend?.iso ??
              (master.dtstart.allDay
                ? addDaysIso(master.dtstart.iso, master.durationDays ?? 1)
                : null),
          },
        ];

    for (const inst of instances) {
      if (events.length >= ICS_MAX_EVENTS) {
        truncated = true;
        break;
      }
      const override = exceptions.find(
        (ex) =>
          ex.uid === master.uid &&
          ex.recurrenceId &&
          (ex.recurrenceId === inst.startsAt ||
            ex.recurrenceId.slice(0, 10) === inst.startsAt.slice(0, 10)),
      );
      const src = override ?? master;
      if (!src.dtstart && !override) continue;
      const startsAt = override?.dtstart?.iso ?? inst.startsAt;
      const endsAt = override?.dtend?.iso ?? inst.endsAt;
      const cancelled =
        (src.status ?? "").toUpperCase() === "CANCELLED" ||
        (override?.status ?? "").toUpperCase() === "CANCELLED";
      const providerEventId = `${master.uid ?? "noid"}:${startsAt}`;
      events.push({
        providerEventId,
        icalUid: master.uid ?? null,
        recurrenceId: inst.recurrenceId ?? override?.recurrenceId ?? null,
        title: (override?.summary ?? master.summary ?? "(Untitled)").slice(0, 500),
        description: (override?.description ?? master.description ?? null)?.slice(
          0,
          4000,
        ),
        location: (override?.location ?? master.location ?? null)?.slice(0, 500),
        startsAt,
        endsAt,
        allDay: override?.dtstart?.allDay ?? master.dtstart.allDay,
        timezone: override?.dtstart?.tzid ?? master.dtstart.tzid ?? null,
        showAs: DEFAULT_SHOW_AS,
        status: src.status ?? null,
        isCancelled: cancelled,
        htmlLink: null,
        recurring: Boolean(master.rrule),
      });
    }
    if (truncated) break;
  }

  // Standalone exceptions without master (rare) — include once.
  for (const ex of exceptions) {
    if (!ex.dtstart || !ex.uid) continue;
    const already = events.some(
      (e) => e.icalUid === ex.uid && e.startsAt === ex.dtstart!.iso,
    );
    if (already) continue;
    if (events.length >= ICS_MAX_EVENTS) {
      truncated = true;
      break;
    }
    events.push({
      providerEventId: `${ex.uid}:${ex.dtstart.iso}`,
      icalUid: ex.uid,
      recurrenceId: ex.recurrenceId ?? null,
      title: (ex.summary ?? "(Untitled)").slice(0, 500),
      description: ex.description?.slice(0, 4000) ?? null,
      location: ex.location?.slice(0, 500) ?? null,
      startsAt: ex.dtstart.iso,
      endsAt: ex.dtend?.iso ?? null,
      allDay: ex.dtstart.allDay,
      timezone: ex.dtstart.tzid ?? null,
      showAs: DEFAULT_SHOW_AS,
      status: ex.status ?? null,
      isCancelled: (ex.status ?? "").toUpperCase() === "CANCELLED",
      htmlLink: null,
      recurring: false,
    });
  }

  return { ok: true, events, truncated };
}
