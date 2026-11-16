import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCalendarItems, destinationToCalItemKind } from "@/lib/calendar-items";
import type {
  ExternalCalendar,
  ExternalCalendarConnection,
  ExternalCalendarEvent,
} from "@/lib/calendar-sync/types";

function baseCalendar(
  overrides: Partial<ExternalCalendar> & Pick<ExternalCalendar, "id" | "enabled">,
): ExternalCalendar {
  return {
    user_id: "u1",
    connection_id: "c1",
    provider_calendar_id: "prov-1",
    name: "Tests",
    color: "#aabbcc",
    timezone: null,
    studi_destination: "external",
    blocks_study: true,
    is_primary: false,
    sync_token: null,
    ctag: null,
    etag: null,
    last_sync_at: null,
    last_successful_sync_at: null,
    last_sync_error: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseEvent(
  overrides: Partial<ExternalCalendarEvent> &
    Pick<ExternalCalendarEvent, "id" | "calendar_id">,
): ExternalCalendarEvent {
  return {
    user_id: "u1",
    connection_id: "c1",
    provider_event_id: "ev-1",
    ical_uid: "uid-1",
    recurrence_id: null,
    title: "Midterm",
    description: null,
    location: null,
    starts_at: "2026-11-20T10:00:00.000Z",
    ends_at: "2026-11-20T11:00:00.000Z",
    all_day: false,
    timezone: null,
    show_as: "busy",
    status: null,
    is_cancelled: false,
    html_link: null,
    recurring: false,
    provider_updated_at: null,
    content_hash: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const connection: ExternalCalendarConnection = {
  id: "c1",
  user_id: "u1",
  provider: "icloud",
  status: "active",
  account_label: "Apple",
  account_email: "a@icloud.com",
  provider_account_id: "apple-1",
  scopes: [],
  last_sync_at: null,
  last_successful_sync_at: null,
  last_sync_error: null,
  sync_cursor: null,
  dedupe_fingerprint: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("buildCalendarItems — external mapping & disable", () => {
  it("drops disabled calendar events from the calendar view", () => {
    const items = buildCalendarItems({
      assessments: [],
      personalEvents: [],
      studySessions: [],
      tasks: [],
      subjects: [],
      externalEvents: [baseEvent({ id: "e1", calendar_id: "cal1" })],
      externalCalendars: [baseCalendar({ id: "cal1", enabled: false })],
      externalConnections: [connection],
    });
    assert.equal(items.length, 0);
  });

  it("changes visual category when destination changes without creating native exams/tasks", () => {
    const event = baseEvent({ id: "e1", calendar_id: "cal1" });
    const asExternal = buildCalendarItems({
      assessments: [],
      personalEvents: [],
      studySessions: [],
      tasks: [],
      subjects: [],
      externalEvents: [event],
      externalCalendars: [
        baseCalendar({
          id: "cal1",
          enabled: true,
          studi_destination: "external",
        }),
      ],
      externalConnections: [connection],
    });
    assert.equal(asExternal[0]?.kind, "external");
    assert.equal(asExternal[0]?.source, "external");
    assert.equal(asExternal[0]?.assessment, undefined);
    assert.equal(asExternal[0]?.task, undefined);

    const asExam = buildCalendarItems({
      assessments: [],
      personalEvents: [],
      studySessions: [],
      tasks: [],
      subjects: [],
      externalEvents: [event],
      externalCalendars: [
        baseCalendar({
          id: "cal1",
          enabled: true,
          studi_destination: "exams",
        }),
      ],
      externalConnections: [connection],
    });
    assert.equal(asExam[0]?.kind, destinationToCalItemKind("exams"));
    assert.equal(asExam[0]?.source, "external");
    assert.equal(asExam[0]?.assessment, undefined);

    const asTask = buildCalendarItems({
      assessments: [],
      personalEvents: [],
      studySessions: [],
      tasks: [],
      subjects: [],
      externalEvents: [event],
      externalCalendars: [
        baseCalendar({
          id: "cal1",
          enabled: true,
          studi_destination: "tasks",
        }),
      ],
      externalConnections: [connection],
    });
    assert.equal(asTask[0]?.kind, "task");
    assert.equal(asTask[0]?.source, "external");
    assert.equal(asTask[0]?.task, undefined);
  });

  it("keeps recurring identity fields intact across remaps", () => {
    const event = baseEvent({
      id: "e-rec",
      calendar_id: "cal1",
      recurring: true,
      ical_uid: "series-1",
      recurrence_id: "2026-11-20",
      provider_event_id: "prov-rec-1",
    });
    const items = buildCalendarItems({
      assessments: [],
      personalEvents: [],
      studySessions: [],
      tasks: [],
      subjects: [],
      externalEvents: [event],
      externalCalendars: [
        baseCalendar({
          id: "cal1",
          enabled: true,
          studi_destination: "deadlines",
        }),
      ],
      externalConnections: [connection],
    });
    assert.equal(items[0]?.external?.provider_event_id, "prov-rec-1");
    assert.equal(items[0]?.external?.ical_uid, "series-1");
    assert.equal(items[0]?.external?.recurrence_id, "2026-11-20");
    assert.equal(items[0]?.kind, "deadline");
  });
});
