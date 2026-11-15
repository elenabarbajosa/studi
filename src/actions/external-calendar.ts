"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  GOOGLE_CALENDAR_SCOPES,
  ICS_MAX_BYTES,
  MICROSOFT_CALENDAR_SCOPES,
  getGoogleCalendarConfig,
  getIcloudCalendarConfig,
  getMicrosoftCalendarConfig,
  isCalendarSecretsKeyConfigured,
  isServiceRoleKeyConfigured,
} from "@/lib/calendar-sync/config";
import { syncConnection } from "@/lib/calendar-sync/engine";
import { parseIcs } from "@/lib/calendar-sync/ics";
import { contentHashForEvent } from "@/lib/calendar-sync/hash";
import { detectAcademicCandidates } from "@/lib/calendar-sync/academic-detect";
import { assertSameOwner } from "@/lib/calendar-sync/ownership";
import {
  deleteConnectionTokens,
  saveConnectionTokens,
} from "@/lib/calendar-sync/secrets";
import type {
  ExternalCalendarConnection,
  ProviderEvent,
} from "@/lib/calendar-sync/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T = undefined> =
  | { ok: true; data?: T; success?: string }
  | { ok: false; error: string };

async function authClient(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  return { ok: true, supabase, user };
}

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/planner");
}

export async function getIntegrationStatusAction(): Promise<
  ActionResult<{
    google: { configured: boolean; missing: string[] };
    microsoft: { configured: boolean; missing: string[] };
    icloud: { configured: boolean; missing: string[] };
    encryptionConfigured: boolean;
  }>
> {
  return {
    ok: true,
    data: {
      google: {
        configured: getGoogleCalendarConfig().configured,
        missing: getGoogleCalendarConfig().missing,
      },
      microsoft: {
        configured: getMicrosoftCalendarConfig().configured,
        missing: getMicrosoftCalendarConfig().missing,
      },
      icloud: {
        configured: getIcloudCalendarConfig().configured,
        missing: getIcloudCalendarConfig().missing,
      },
      encryptionConfigured: isCalendarSecretsKeyConfigured(),
    },
  };
}

export async function syncNowAction(
  connectionId: string,
): Promise<ActionResult<{ upserted: number; deleted: number }>> {
  const auth = await authClient();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user } = auth;

  const id = z.string().uuid().safeParse(connectionId);
  if (!id.success) return { ok: false, error: "Invalid connection." };

  const { data: connection, error } = await supabase
    .from("external_calendar_connections")
    .select("*")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !connection) {
    return { ok: false, error: "Connection not found." };
  }
  if (connection.provider === "ics") {
    return { ok: false, error: "ICS imports are one-time and do not sync." };
  }

  const result = await syncConnection(
    supabase,
    connection as ExternalCalendarConnection,
  );
  revalidateCalendar();
  if (!result.ok) {
    return {
      ok: false,
      error: result.needsReauth
        ? `${result.error} Please reconnect your calendar.`
        : (result.error ?? "Sync failed."),
    };
  }
  return {
    ok: true,
    data: { upserted: result.upserted, deleted: result.deleted },
    success: result.partial
      ? `Synced with issues: ${result.error}`
      : "Calendar synchronized.",
  };
}

export async function setCalendarEnabledAction(input: {
  calendarId: string;
  enabled: boolean;
}): Promise<ActionResult> {
  const auth = await authClient();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user } = auth;
  const parsed = z
    .object({
      calendarId: z.string().uuid(),
      enabled: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const { error } = await supabase
    .from("external_calendars")
    .update({ enabled: parsed.data.enabled })
    .eq("id", parsed.data.calendarId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateCalendar();
  return { ok: true, success: parsed.data.enabled ? "Calendar enabled." : "Calendar disabled." };
}

export async function disconnectConnectionAction(
  connectionId: string,
): Promise<ActionResult> {
  const auth = await authClient();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user } = auth;
  const id = z.string().uuid().safeParse(connectionId);
  if (!id.success) return { ok: false, error: "Invalid connection." };

  // Remove encrypted credentials via service role before deleting the connection.
  try {
    await deleteConnectionTokens({
      connectionId: id.data,
      userId: user.id,
    });
  } catch (err) {
    console.error(
      "disconnect secret cleanup:",
      err instanceof Error ? err.message : "failed",
    );
  }

  const { error } = await supabase
    .from("external_calendar_connections")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateCalendar();
  return {
    ok: true,
    success:
      "Disconnected. Synced events were removed. Revoke app access at the provider if desired.",
  };
}

export async function importIcsAction(input: {
  filename: string;
  contentBase64: string;
  selectedProviderEventIds: string[];
}): Promise<ActionResult<{ imported: number }>> {
  const auth = await authClient();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user } = auth;

  const schema = z.object({
    filename: z.string().min(1).max(200),
    contentBase64: z.string().min(1).max(Math.ceil(ICS_MAX_BYTES * 1.4)),
    selectedProviderEventIds: z.array(z.string().max(500)).max(2000),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid ICS upload." };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsed.data.contentBase64, "base64");
  } catch {
    return { ok: false, error: "Could not read the uploaded file." };
  }
  if (buffer.byteLength > ICS_MAX_BYTES) {
    return { ok: false, error: "File is too large (max 2 MB)." };
  }

  const result = parseIcs(buffer);
  if (!result.ok) return { ok: false, error: result.error.message };

  const selected = new Set(parsed.data.selectedProviderEventIds);
  const toImport = result.events.filter(
    (e) => selected.has(e.providerEventId) && !e.isCancelled,
  );
  if (toImport.length === 0) {
    return { ok: false, error: "Select at least one event to import." };
  }

  const label = parsed.data.filename.replace(/\.ics$/i, "").slice(0, 120);
  const { data: connection, error: connErr } = await supabase
    .from("external_calendar_connections")
    .insert({
      user_id: user.id,
      provider: "ics",
      status: "active",
      account_label: label || "ICS import",
      account_email: null,
      provider_account_id: `ics:${Date.now()}`,
      scopes: [],
      last_successful_sync_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (connErr || !connection) {
    return { ok: false, error: connErr?.message ?? "Could not create import." };
  }

  // ICS imports do not store provider credentials. Optional empty ciphertext
  // keeps disconnect uniform when encryption + service role are configured.
  if (isCalendarSecretsKeyConfigured() && isServiceRoleKeyConfigured()) {
    await saveConnectionTokens({
      connectionId: connection.id,
      userId: user.id,
      tokens: { accessToken: "" },
    });
  }

  const { data: calendar, error: calErr } = await supabase
    .from("external_calendars")
    .insert({
      user_id: user.id,
      connection_id: connection.id,
      provider_calendar_id: "ics-import",
      name: label || "Imported calendar",
      enabled: true,
      is_primary: true,
      last_successful_sync_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (calErr || !calendar) {
    await supabase
      .from("external_calendar_connections")
      .delete()
      .eq("id", connection.id);
    return { ok: false, error: calErr?.message ?? "Could not create calendar." };
  }

  const rows = toImport.map((event: ProviderEvent) => ({
    user_id: user.id,
    connection_id: connection.id,
    calendar_id: calendar.id,
    provider_event_id: event.providerEventId,
    ical_uid: event.icalUid ?? null,
    recurrence_id: event.recurrenceId ?? null,
    title: event.title.slice(0, 500),
    description: event.description?.slice(0, 4000) ?? null,
    location: event.location?.slice(0, 500) ?? null,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    all_day: event.allDay,
    timezone: event.timezone ?? null,
    show_as: event.showAs,
    status: event.status ?? null,
    is_cancelled: event.isCancelled,
    html_link: null,
    recurring: Boolean(event.recurring),
    content_hash: contentHashForEvent(event),
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase
      .from("external_calendar_events")
      .upsert(rows.slice(i, i + 100), {
        onConflict: "calendar_id,provider_event_id",
      });
    if (error) return { ok: false, error: error.message };
  }

  revalidateCalendar();
  return {
    ok: true,
    data: { imported: rows.length },
    success: `Imported ${rows.length} event${rows.length === 1 ? "" : "s"} (one-time, not synced).`,
  };
}

export async function parseIcsPreviewAction(input: {
  contentBase64: string;
}): Promise<
  ActionResult<{
    events: Array<{
      providerEventId: string;
      title: string;
      startsAt: string;
      endsAt: string | null;
      allDay: boolean;
      isCancelled: boolean;
    }>;
    truncated: boolean;
  }>
> {
  const auth = await authClient();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = z
    .object({
      contentBase64: z.string().min(1).max(Math.ceil(ICS_MAX_BYTES * 1.4)),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload." };

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsed.data.contentBase64, "base64");
  } catch {
    return { ok: false, error: "Could not read the file." };
  }
  if (buffer.byteLength > ICS_MAX_BYTES) {
    return { ok: false, error: "File is too large (max 2 MB)." };
  }

  const result = parseIcs(buffer);
  if (!result.ok) return { ok: false, error: result.error.message };

  return {
    ok: true,
    data: {
      truncated: result.truncated,
      events: result.events.slice(0, 500).map((e) => ({
        providerEventId: e.providerEventId,
        title: e.title,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        allDay: e.allDay,
        isCancelled: e.isCancelled,
      })),
    },
  };
}

export async function listAcademicSuggestionsAction(): Promise<
  ActionResult<ReturnType<typeof detectAcademicCandidates>>
> {
  const auth = await authClient();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user } = auth;

  const { data: links } = await supabase
    .from("external_event_links")
    .select("external_event_id")
    .eq("user_id", user.id);
  const linked = new Set((links ?? []).map((l) => l.external_event_id));

  const { data: events } = await supabase
    .from("external_calendar_events")
    .select("id, title, description, all_day, is_cancelled")
    .eq("user_id", user.id)
    .eq("is_cancelled", false)
    .order("starts_at", { ascending: true })
    .limit(400);

  const candidates = detectAcademicCandidates(events ?? []).filter(
    (c) => !linked.has(c.eventId),
  );
  return { ok: true, data: candidates };
}

export async function resolveAcademicSuggestionAction(input: {
  externalEventId: string;
  action: "ignore" | "create_exam" | "create_task" | "link_assessment";
  subjectId?: string | null;
  assessmentId?: string | null;
  title?: string;
  assessmentType?: string;
}): Promise<ActionResult> {
  const auth = await authClient();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user } = auth;

  const parsed = z
    .object({
      externalEventId: z.string().uuid(),
      action: z.enum(["ignore", "create_exam", "create_task", "link_assessment"]),
      subjectId: z.string().uuid().nullable().optional(),
      assessmentId: z.string().uuid().nullable().optional(),
      title: z.string().min(1).max(200).optional(),
      assessmentType: z
        .enum([
          "final",
          "midterm",
          "quiz",
          "assignment",
          "project",
          "presentation",
          "other",
        ])
        .optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const { data: event } = await supabase
    .from("external_calendar_events")
    .select("*")
    .eq("id", parsed.data.externalEventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!event) return { ok: false, error: "Event not found." };

  const fingerprint = event.content_hash ?? event.provider_event_id;

  if (parsed.data.action === "ignore") {
    const { error } = await supabase.from("external_event_links").upsert(
      {
        user_id: user.id,
        external_event_id: event.id,
        kind: "ignored",
        assessment_id: null,
        task_id: null,
        source_fingerprint: fingerprint,
      },
      { onConflict: "external_event_id" },
    );
    if (error) return { ok: false, error: error.message };
    revalidateCalendar();
    return { ok: true, success: "Suggestion dismissed." };
  }

  if (parsed.data.action === "link_assessment") {
    if (!parsed.data.assessmentId) {
      return { ok: false, error: "Choose an existing exam or deadline." };
    }
    const { data: ownedAssessment } = await supabase
      .from("assessments")
      .select("id, user_id")
      .eq("id", parsed.data.assessmentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ownedAssessment) {
      return { ok: false, error: "Assessment not found." };
    }
    const ownership = assertSameOwner({
      eventOwnerId: event.user_id,
      actorUserId: user.id,
      assessmentOwnerId: ownedAssessment.user_id,
    });
    if (!ownership.ok) return { ok: false, error: ownership.error };
    const { error } = await supabase.from("external_event_links").upsert(
      {
        user_id: user.id,
        external_event_id: event.id,
        kind: "assessment",
        assessment_id: parsed.data.assessmentId,
        task_id: null,
        source_fingerprint: fingerprint,
      },
      { onConflict: "external_event_id" },
    );
    if (error) return { ok: false, error: error.message };
    revalidateCalendar();
    return { ok: true, success: "Linked to existing assessment." };
  }

  if (parsed.data.action === "create_exam") {
    // Never invent an exam start from a date-only due without confirmation —
    // UI must pass the times they confirmed (we use the external event times).
    const { data: assessment, error } = await supabase
      .from("assessments")
      .insert({
        user_id: user.id,
        subject_id: parsed.data.subjectId ?? null,
        title: (parsed.data.title ?? event.title).slice(0, 200),
        assessment_type: parsed.data.assessmentType ?? "other",
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        all_day: event.all_day,
        location: event.location,
        description: event.description,
        priority: "medium",
      })
      .select("id")
      .single();
    if (error || !assessment) {
      return { ok: false, error: error?.message ?? "Could not create exam." };
    }
    await supabase.from("external_event_links").upsert(
      {
        user_id: user.id,
        external_event_id: event.id,
        kind: "assessment",
        assessment_id: assessment.id,
        task_id: null,
        proposed_title: event.title,
        proposed_type: parsed.data.assessmentType ?? "other",
        source_fingerprint: fingerprint,
      },
      { onConflict: "external_event_id" },
    );
    revalidateCalendar();
    return { ok: true, success: "Created in Studi. External event stays read-only." };
  }

  // create_task
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      subject_id: parsed.data.subjectId ?? null,
      title: (parsed.data.title ?? event.title).slice(0, 200),
      due_at: event.starts_at,
      status: "todo",
      priority: "medium",
      estimated_minutes: 60,
    })
    .select("id")
    .single();
  if (error || !task) {
    return { ok: false, error: error?.message ?? "Could not create task." };
  }
  await supabase.from("external_event_links").upsert(
    {
      user_id: user.id,
      external_event_id: event.id,
      kind: "task",
      assessment_id: null,
      task_id: task.id,
      proposed_title: event.title,
      proposed_type: "assignment",
      source_fingerprint: fingerprint,
    },
    { onConflict: "external_event_id" },
  );
  revalidateCalendar();
  return { ok: true, success: "Created task from calendar event." };
}

export async function oauthProviderReady(
  provider: "google" | "microsoft",
): Promise<ActionResult<{ redirectUri: string; scopes: readonly string[] }>> {
  if (provider === "google") {
    const cfg = getGoogleCalendarConfig();
    if (!cfg.configured) {
      return {
        ok: false,
        error: `Setup required: missing ${cfg.missing.join(", ")}`,
      };
    }
    return {
      ok: true,
      data: { redirectUri: cfg.redirectUri, scopes: GOOGLE_CALENDAR_SCOPES },
    };
  }
  const cfg = getMicrosoftCalendarConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      error: `Setup required: missing ${cfg.missing.join(", ")}`,
    };
  }
  return {
    ok: true,
    data: { redirectUri: cfg.redirectUri, scopes: MICROSOFT_CALENDAR_SCOPES },
  };
}
