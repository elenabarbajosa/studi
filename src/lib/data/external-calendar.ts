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
import type {
  ExternalCalendar,
  ExternalCalendarConnection,
  ExternalCalendarEvent,
  ExternalEventLink,
  ProviderConfigStatus,
} from "@/lib/calendar-sync/types";
import { createClient } from "@/lib/supabase/server";

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
    return (data ?? []) as ExternalCalendar[];
  },
);

export const listExternalCalendarEvents = cache(
  async (): Promise<ExternalCalendarEvent[]> => {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("external_calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_cancelled", false)
      .order("starts_at", { ascending: true });
    if (error) {
      // Table may not exist until migration 018 is applied.
      console.error("listExternalCalendarEvents:", error.message);
      return [];
    }
    return (data ?? []) as ExternalCalendarEvent[];
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

export async function listBusyExternalEvents(): Promise<ExternalCalendarEvent[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data: calendars } = await supabase
    .from("external_calendars")
    .select("id")
    .eq("user_id", user.id)
    .eq("enabled", true);
  const enabledIds = (calendars ?? []).map((c) => c.id);
  if (enabledIds.length === 0) return [];

  const { data, error } = await supabase
    .from("external_calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_cancelled", false)
    .in("calendar_id", enabledIds)
    .neq("show_as", "free");
  if (error) {
    console.error("listBusyExternalEvents:", error.message);
    return [];
  }
  return (data ?? []) as ExternalCalendarEvent[];
}
