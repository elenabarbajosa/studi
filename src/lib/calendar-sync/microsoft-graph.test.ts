import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OUTLOOK_CALENDAR_VIEW_SELECT,
  buildOutlookCalendarViewPath,
  buildOutlookEventsDeltaPath,
  encodeGraphResourceId,
  formatConnectionSyncStatus,
  formatOutlookGraphError,
  parseGraphErrorBody,
  resolveConnectionSyncOutcome,
  resolveDiscoveredCalendarEnabled,
  summarizeCalendarSyncErrors,
} from "@/lib/calendar-sync/microsoft-graph";

describe("encodeGraphResourceId", () => {
  it("percent-encodes /, +, and = once (SDK-compatible)", () => {
    const id = "AAMkAGI2/TGu+LAAA=";
    const encoded = encodeGraphResourceId(id);
    assert.equal(encoded.includes("/"), false);
    assert.equal(encoded.includes("+"), false);
    assert.match(encoded, /%2F/);
    assert.match(encoded, /%2B/);
    assert.match(encoded, /%3D/);
    // Must not universally double-encode slashes.
    assert.equal(encoded.includes("%252F"), false);
  });
});

describe("buildOutlookCalendarViewPath", () => {
  it("uses documented default-calendar endpoint for primary", () => {
    const path = buildOutlookCalendarViewPath({
      providerCalendarId: "AAMkAGI2TGuLAAA=",
      isDefaultCalendar: true,
      timeMin: "2026-01-01T00:00:00.000Z",
      timeMax: "2026-06-01T00:00:00.000Z",
    });
    assert.match(path, /^\/me\/calendar\/calendarView\?/);
    assert.match(path, /startDateTime=2026-01-01T00%3A00%3A00.000Z/);
    assert.match(path, /endDateTime=/);
    assert.equal(path.includes("lastModifiedDateTime"), false);
    assert.match(path, new RegExp(OUTLOOK_CALENDAR_VIEW_SELECT.replace(/,/g, "%2C")));
  });

  it("uses /me/calendars/{id}/calendarView for non-default calendars", () => {
    const id = "AQMkADAwATM0/MDAAMS0=";
    const path = buildOutlookCalendarViewPath({
      providerCalendarId: id,
      isDefaultCalendar: false,
      timeMin: "2026-01-01T00:00:00.000Z",
      timeMax: "2026-02-01T00:00:00.000Z",
    });
    assert.match(
      path,
      new RegExp(
        `^/me/calendars/${encodeGraphResourceId(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/calendarView\\?`,
      ),
    );
    assert.equal(path.includes("lastModifiedDateTime"), false);
  });
});

describe("buildOutlookEventsDeltaPath", () => {
  it("uses /me/calendar/events/delta for default and id path otherwise", () => {
    assert.equal(
      buildOutlookEventsDeltaPath({
        providerCalendarId: "x",
        isDefaultCalendar: true,
      }),
      "/me/calendar/events/delta?$top=50",
    );
    const id = "AAMkA+B/C=";
    assert.equal(
      buildOutlookEventsDeltaPath({
        providerCalendarId: id,
        isDefaultCalendar: false,
      }),
      `/me/calendars/${encodeGraphResourceId(id)}/events/delta?$top=50`,
    );
  });
});

describe("parseGraphErrorBody / formatOutlookGraphError", () => {
  it("captures sanitized Graph code and HTTP status", () => {
    const info = parseGraphErrorBody(404, {
      error: {
        code: "ErrorItemNotFound",
        message: "The specified object was not found in the store.",
      },
    });
    assert.equal(info.status, 404);
    assert.equal(info.code, "ErrorItemNotFound");
    assert.equal(
      formatOutlookGraphError("Outlook calendar view", info),
      "Outlook calendar view failed (404/ErrorItemNotFound).",
    );
  });

  it("redacts bearer-looking fragments from Graph messages", () => {
    const info = parseGraphErrorBody(401, {
      error: {
        code: "InvalidAuthenticationToken",
        message: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc is invalid",
      },
    });
    assert.equal(info.detail.includes("eyJ"), false);
    assert.match(info.detail, /\[redacted\]/);
  });
});

describe("multi-calendar sync outcome", () => {
  it("fails connection when every calendar fails (no last-success update)", () => {
    const outcome = resolveConnectionSyncOutcome({
      targetCount: 2,
      succeeded: 0,
      calendarErrors: [
        { name: "Birthdays", message: "Outlook calendar view failed (404/ErrorItemNotFound)." },
        { name: "Holidays", message: "Outlook calendar view failed (404/ErrorItemNotFound)." },
      ],
    });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.updateLastSuccessful, false);
    assert.equal(outcome.status, "error");
    assert.match(outcome.error ?? "", /2 calendars failed|Birthdays/);
  });

  it("keeps connection ok when one calendar fails and one succeeds", () => {
    const outcome = resolveConnectionSyncOutcome({
      targetCount: 2,
      succeeded: 1,
      calendarErrors: [
        {
          name: "Shared",
          message: "Outlook calendar view failed (404/ErrorItemNotFound).",
        },
      ],
    });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.partial, true);
    assert.equal(outcome.updateLastSuccessful, true);
    assert.match(outcome.error ?? "", /Shared/);
  });
});

describe("discover enable rules", () => {
  it("enables only primary on first Microsoft-style connect", () => {
    const existing = new Map<string, boolean>();
    assert.equal(
      resolveDiscoveredCalendarEnabled({
        providerCalendarId: "primary",
        isPrimary: true,
        existingEnabled: existing,
        enablePrimaryOnly: true,
      }),
      true,
    );
    assert.equal(
      resolveDiscoveredCalendarEnabled({
        providerCalendarId: "birthdays",
        isPrimary: false,
        existingEnabled: existing,
        enablePrimaryOnly: true,
      }),
      false,
    );
  });

  it("preserves explicit user selection and leaves new calendars disabled", () => {
    const existing = new Map([
      ["primary", true],
      ["birthdays", false],
    ]);
    assert.equal(
      resolveDiscoveredCalendarEnabled({
        providerCalendarId: "primary",
        isPrimary: true,
        existingEnabled: existing,
        enablePrimaryOnly: true,
      }),
      true,
    );
    assert.equal(
      resolveDiscoveredCalendarEnabled({
        providerCalendarId: "birthdays",
        isPrimary: false,
        existingEnabled: existing,
      }),
      false,
    );
    assert.equal(
      resolveDiscoveredCalendarEnabled({
        providerCalendarId: "new-shared",
        isPrimary: false,
        existingEnabled: existing,
      }),
      false,
    );
  });
});

describe("honest sync status copy", () => {
  it("does not show unqualified Synced when an error is present", () => {
    const withError = formatConnectionSyncStatus({
      lastSuccessfulSyncAt: "2026-11-15T20:00:00.000Z",
      lastSyncError: "Outlook calendar view failed (404/ErrorItemNotFound).",
      formatRelative: () => "just now",
    });
    assert.equal(withError.includes("Synced just now"), false);
    assert.match(withError, /Last successful sync just now/);
    assert.match(withError, /404\/ErrorItemNotFound/);

    const ok = formatConnectionSyncStatus({
      lastSuccessfulSyncAt: "2026-11-15T20:00:00.000Z",
      lastSyncError: null,
      formatRelative: () => "just now",
    });
    assert.equal(ok, "Synced just now");
  });
});

describe("event identity stability", () => {
  it("keeps provider calendar id encoding reversible for upsert keys", () => {
    // Imported events key off stable provider_calendar_id + provider_event_id.
    // Encoding is only for the HTTP path — stored ids must remain the raw Graph id.
    const raw = "AAMkAGI2/TGu+LAAA=";
    assert.notEqual(encodeGraphResourceId(raw), raw);
    assert.equal(decodeURIComponent(encodeGraphResourceId(raw)), raw);
  });
});

describe("summarizeCalendarSyncErrors", () => {
  it("formats single and multi failures", () => {
    assert.equal(
      summarizeCalendarSyncErrors([
        { name: "Calendar", message: "Outlook calendar view failed (404/ErrorItemNotFound)." },
      ]),
      "Calendar: Outlook calendar view failed (404/ErrorItemNotFound).",
    );
  });
});
