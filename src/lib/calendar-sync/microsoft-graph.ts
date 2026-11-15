/**
 * Pure Microsoft Graph URL/error helpers (no I/O).
 * Encoding follows Graph SDK practice: encodeURIComponent once per path segment.
 * Default calendar uses /me/calendar/... to avoid id path issues entirely.
 */

/** Safe $select for calendarView — excludes lastModifiedDateTime (unsupported). */
export const OUTLOOK_CALENDAR_VIEW_SELECT =
  "id,subject,bodyPreview,start,end,isAllDay,showAs,isCancelled,webLink,iCalUId,recurrence,seriesMasterId,location";

/**
 * Encode a Graph resource id for use as a single path segment.
 * Uses one encodeURIComponent pass (matches MS Graph JS SDK). Do not
 * universally double-encode — that breaks many tenants/IDs.
 */
export function encodeGraphResourceId(id: string): string {
  return encodeURIComponent(id);
}

export function buildOutlookCalendarViewPath(input: {
  providerCalendarId: string;
  isDefaultCalendar?: boolean;
  timeMin: string;
  timeMax: string;
}): string {
  const params = new URLSearchParams();
  params.set("startDateTime", input.timeMin);
  params.set("endDateTime", input.timeMax);
  params.set("$top", "100");
  params.set("$select", OUTLOOK_CALENDAR_VIEW_SELECT);

  if (input.isDefaultCalendar) {
    return `/me/calendar/calendarView?${params.toString()}`;
  }
  return `/me/calendars/${encodeGraphResourceId(input.providerCalendarId)}/calendarView?${params.toString()}`;
}

export function buildOutlookEventsDeltaPath(input: {
  providerCalendarId: string;
  isDefaultCalendar?: boolean;
}): string {
  if (input.isDefaultCalendar) {
    return "/me/calendar/events/delta?$top=50";
  }
  return `/me/calendars/${encodeGraphResourceId(input.providerCalendarId)}/events/delta?$top=50`;
}

export type GraphErrorInfo = {
  status: number;
  code: string;
  /** Short sanitized message — never includes tokens or full event payloads. */
  detail: string;
};

export function parseGraphErrorBody(
  status: number,
  body: unknown,
): GraphErrorInfo {
  let code = "http_error";
  let detail = "";
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown }).error;
    if (err && typeof err === "object") {
      const e = err as { code?: unknown; message?: unknown };
      if (typeof e.code === "string" && e.code.trim()) {
        code = e.code.trim().slice(0, 120);
      }
      if (typeof e.message === "string" && e.message.trim()) {
        // Keep short; strip anything that looks like a token/bearer blob.
        detail = e.message
          .replace(/Bearer\s+\S+/gi, "[redacted]")
          .trim()
          .slice(0, 160);
      }
    }
  }
  return { status, code, detail };
}

export function formatOutlookGraphError(
  operation: string,
  info: GraphErrorInfo,
): string {
  return `${operation} failed (${info.status}/${info.code}).`;
}

/** Summarize per-calendar failures for connection.last_sync_error (no PII dumps). */
export function summarizeCalendarSyncErrors(
  errors: Array<{ name: string; message: string }>,
): string {
  if (errors.length === 0) return "";
  if (errors.length === 1) {
    return `${errors[0]!.name}: ${errors[0]!.message}`.slice(0, 500);
  }
  return `${errors.length} calendars failed to sync (e.g. ${errors[0]!.name}: ${errors[0]!.message})`.slice(
    0,
    500,
  );
}

/**
 * Connection list copy: never show an unqualified "Synced …" when there is a
 * current error — prefer honest last-success + error.
 */
export function formatConnectionSyncStatus(input: {
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  formatRelative: (iso: string) => string;
}): string {
  const parts: string[] = [];
  if (input.lastSyncError) {
    if (input.lastSuccessfulSyncAt) {
      parts.push(
        `Last successful sync ${input.formatRelative(input.lastSuccessfulSyncAt)}`,
      );
    }
    parts.push(input.lastSyncError);
  } else if (input.lastSuccessfulSyncAt) {
    parts.push(`Synced ${input.formatRelative(input.lastSuccessfulSyncAt)}`);
  }
  return parts.join(" · ");
}

/**
 * Decide enabled flag when discovering calendars.
 * Preserves user selections; primary-only on brand-new connections.
 */
export function resolveDiscoveredCalendarEnabled(input: {
  providerCalendarId: string;
  isPrimary: boolean;
  existingEnabled: Map<string, boolean>;
  enablePrimaryOnly?: boolean;
}): boolean {
  if (input.existingEnabled.has(input.providerCalendarId)) {
    return input.existingEnabled.get(input.providerCalendarId)!;
  }
  if (input.existingEnabled.size > 0) {
    // New calendar on an existing connection — opt-in.
    return false;
  }
  if (input.enablePrimaryOnly) return input.isPrimary;
  return true;
}

/** Aggregate sync outcome for connection-level status (pure). */
export function resolveConnectionSyncOutcome(input: {
  targetCount: number;
  succeeded: number;
  calendarErrors: Array<{ name: string; message: string }>;
}): {
  ok: boolean;
  partial: boolean;
  status: "active" | "error";
  error: string | null;
  updateLastSuccessful: boolean;
} {
  const failed = input.calendarErrors.length;
  const error = summarizeCalendarSyncErrors(input.calendarErrors) || null;
  if (input.targetCount > 0 && input.succeeded === 0) {
    return {
      ok: false,
      partial: false,
      status: "error",
      error: error ?? "Synchronization failed.",
      updateLastSuccessful: false,
    };
  }
  if (failed > 0) {
    return {
      ok: true,
      partial: true,
      status: "active",
      error,
      updateLastSuccessful: true,
    };
  }
  return {
    ok: true,
    partial: false,
    status: "active",
    error: null,
    updateLastSuccessful: true,
  };
}
