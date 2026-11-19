import "server-only";

import { cache } from "react";

import { getSessionUser } from "@/lib/auth";
import {
  getGoogleCalendarConfig,
  getIcloudCalendarConfig,
  getIcsImportConfig,
  getMicrosoftCalendarConfig,
  getCronSecretConfigured,
  isCalendarSecretsKeyConfigured,
  isServiceRoleKeyConfigured,
} from "@/lib/calendar-sync/config";
import {
  DEFAULT_EXTERNAL_CALENDAR_BLOCKS_STUDY,
  normalizeExternalCalendarDestination,
} from "@/lib/calendar-sync/calendar-settings";
import type {
  ExternalCalendar,
  ExternalCalendarConnection,
  ExternalCalendarEvent,
  ExternalEventLink,
  ProviderConfigStatus,
} from "@/lib/calendar-sync/types";
import { fetchAllPages, overlapOrFilter, type PagedResult } from "@/lib/data/paged-query";
import { createClient } from "@/lib/supabase/server";

function normalizeCalendarRow(row: ExternalCalendar): ExternalCalendar {
  return {
    ...row,
    studi_destination: normalizeExternalCalendarDestination(
      row.studi_destination,
    ),
    blocks_study:
      typeof row.blocks_study === "boolean"
        ? row.blocks_study
        : DEFAULT_EXTERNAL_CALENDAR_BLOCKS_STUDY,
  };
}

export type CalendarIntegrationStatus = {
  google: ProviderConfigStatus;
  microsoft: ProviderConfigStatus;
  icloud: ProviderConfigStatus;
  ics: ProviderConfigStatus;
  cronConfigured: boolean;
  encryptionConfigured: boolean;
};

export const getCalendarIntegrationStatus = cache(
  async (): Promise<CalendarIntegrationStatus> => {
    const google = getGoogleCalendarConfig();
    const microsoft = getMicrosoftCalendarConfig();
    const icloud = getIcloudCalendarConfig();
    return {
      google: {
        configured: google.configured,
        missing: google.missing,
        setupHint: google.setupHint,
      },
      microsoft: {
        configured: microsoft.configured,
        missing: microsoft.missing,
        setupHint: microsoft.setupHint,
      },
      icloud: {
        configured: icloud.configured,
        missing: icloud.missing,
        setupHint: icloud.setupHint,
      },
      ics: getIcsImportConfig(),
      cronConfigured: getCronSecretConfigured(),
      encryptionConfigured:
        isCalendarSecretsKeyConfigured() && isServiceRoleKeyConfigured(),
    };
  },
);

export const listExternalConnections = cache(
  async (): Promise<ExternalCalendarConnection[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("external_calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "disconnected")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("listExternalConnections:", error.message);
      return [];
    }
    return (data ?? []) as ExternalCalendarConnection[];
  },
);

export const listExternalCalendars = cache(
  async (connectionId?: string): Promise<ExternalCalendar[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    let query = supabase
      .from("external_calendars")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    if (connectionId) query = query.eq("connection_id", connectionId);
    const { data, error } = await query;
    if (error) {
      console.error("listExternalCalendars:", error.message);
      return [];
    }
    return ((data ?? []) as ExternalCalendar[]).map(normalizeCalendarRow);
  },
);

export const listExternalCalendarEventsInRange = cache(
  async (
    startIso: string,
    endIso: string,
  ): Promise<PagedResult<ExternalCalendarEvent>> => {
    const user = await getSessionUser();
    if (!user) return { data: [], error: null };
    const supabase = await createClient();
    const result = await fetchAllPages<ExternalCalendarEvent>((from, to) =>
      supabase
        .from("external_calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_cancelled", false)
        .or(overlapOrFilter(startIso, endIso))
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (result.error) {
      // Table may not exist until migration 018 is applied.
      console.error("listExternalCalendarEventsInRange:", result.error);
    }
    return {
      data: result.data as ExternalCalendarEvent[],
      error: result.error,
    };
  },
);

export const listExternalEventLinks = cache(
  async (): Promise<ExternalEventLink[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("external_event_links")
      .select("*")
      .eq("user_id", user.id);
    if (error) {
      console.error("listExternalEventLinks:", error.message);
      return [];
    }
    return (data ?? []) as ExternalEventLink[];
  },
);

export async function listBusyExternalEvents(
  startIso: string,
  endIso: string,
): Promise<PagedResult<ExternalCalendarEvent>> {
  const user = await getSessionUser();
  if (!user) return { data: [], error: null };
  const supabase = await createClient();
  // Enabled + blocks_study — disabled calendars never block planner time.
  const { data: calendars, error: calendarError } = await supabase
    .from("external_calendars")
    .select("id")
    .eq("user_id", user.id)
    .eq("enabled", true)
    .eq("blocks_study", true);
  if (calendarError) {
    console.error("listBusyExternalEvents:", calendarError.message);
    return { data: [], error: calendarError.message };
  }
  const blockingIds = (calendars ?? []).map((c) => c.id);
  if (blockingIds.length === 0) return { data: [], error: null };

  const result = await fetchAllPages<ExternalCalendarEvent>((from, to) =>
    supabase
      .from("external_calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_cancelled", false)
      .in("calendar_id", blockingIds)
      .neq("show_as", "free")
      .or(overlapOrFilter(startIso, endIso))
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (result.error) console.error("listBusyExternalEvents:", result.error);
  return {
    data: result.data as ExternalCalendarEvent[],
    error: result.error,
  };
}
