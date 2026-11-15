import "server-only";

import {
  isUniqueConstraintError,
  resolveOwnedConnectionReuse,
  type ConnectionLookupRow,
} from "@/lib/calendar-sync/connection-reuse";
import { safePublicError } from "@/lib/calendar-sync/safe-errors";
import type {
  ExternalCalendarConnection,
  ExternalCalendarProvider,
} from "@/lib/calendar-sync/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type UpsertOwnedConnectionInput = {
  userId: string;
  provider: Exclude<ExternalCalendarProvider, "ics">;
  providerAccountId: string;
  accountLabel: string | null;
  accountEmail: string | null;
  scopes: string[];
};

export type UpsertOwnedConnectionResult =
  | {
      ok: true;
      connection: ExternalCalendarConnection;
      reused: boolean;
    }
  | { ok: false; error: string };

const PENDING_PATCH = {
  status: "pending" as const,
  last_sync_error: null,
};

/**
 * Insert or reuse an owned connection for (user, provider, provider_account_id).
 * Preserves calendars/events on reconnect. Never updates another user's row.
 * Handles unique-constraint races from concurrent connect attempts.
 */
export async function upsertOwnedConnection(
  supabase: Supabase,
  input: UpsertOwnedConnectionInput,
): Promise<UpsertOwnedConnectionResult> {
  const providerAccountId = input.providerAccountId.trim();
  if (!providerAccountId) {
    return { ok: false, error: "Could not identify the calendar account." };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("external_calendar_connections")
    .select("*")
    .eq("user_id", input.userId)
    .eq("provider", input.provider)
    .eq("provider_account_id", providerAccountId)
    .maybeSingle();

  if (lookupError) {
    return {
      ok: false,
      error: safePublicError(lookupError, "Could not look up calendar connection."),
    };
  }

  const decision = resolveOwnedConnectionReuse({
    actorUserId: input.userId,
    provider: input.provider,
    providerAccountId,
    candidates: existing ? [existing as ConnectionLookupRow] : [],
  });

  if (decision.action === "forbidden") {
    return { ok: false, error: "Could not save calendar connection." };
  }

  if (decision.action === "reuse") {
    return updateOwnedPending(supabase, input, decision.connection.id, true);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("external_calendar_connections")
    .insert({
      user_id: input.userId,
      provider: input.provider,
      status: "pending",
      account_label: input.accountLabel,
      account_email: input.accountEmail,
      provider_account_id: providerAccountId,
      scopes: input.scopes,
      last_sync_error: null,
    })
    .select("*")
    .single();

  if (!insertError && inserted) {
    if ((inserted as ExternalCalendarConnection).user_id !== input.userId) {
      return { ok: false, error: "Could not save calendar connection." };
    }
    return {
      ok: true,
      connection: inserted as ExternalCalendarConnection,
      reused: false,
    };
  }

  // Concurrent connect: unique constraint race — reload own row and update.
  if (isUniqueConstraintError(insertError)) {
    const { data: raced, error: raceLookupError } = await supabase
      .from("external_calendar_connections")
      .select("*")
      .eq("user_id", input.userId)
      .eq("provider", input.provider)
      .eq("provider_account_id", providerAccountId)
      .maybeSingle();

    if (raceLookupError || !raced) {
      return {
        ok: false,
        error:
          "This calendar account is already being connected. Wait a moment and try again.",
      };
    }

    const raceDecision = resolveOwnedConnectionReuse({
      actorUserId: input.userId,
      provider: input.provider,
      providerAccountId,
      candidates: [raced as ConnectionLookupRow],
    });
    if (raceDecision.action !== "reuse") {
      return { ok: false, error: "Could not save calendar connection." };
    }
    return updateOwnedPending(supabase, input, raceDecision.connection.id, true);
  }

  return {
    ok: false,
    error: safePublicError(insertError, "Could not save calendar connection."),
  };
}

async function updateOwnedPending(
  supabase: Supabase,
  input: UpsertOwnedConnectionInput,
  connectionId: string,
  reused: boolean,
): Promise<UpsertOwnedConnectionResult> {
  const { data: updated, error } = await supabase
    .from("external_calendar_connections")
    .update({
      ...PENDING_PATCH,
      account_label: input.accountLabel,
      account_email: input.accountEmail,
      scopes: input.scopes,
      provider_account_id: input.providerAccountId.trim(),
    })
    .eq("id", connectionId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error || !updated) {
    return {
      ok: false,
      error: safePublicError(error, "Could not update calendar connection."),
    };
  }
  if ((updated as ExternalCalendarConnection).user_id !== input.userId) {
    return { ok: false, error: "Could not save calendar connection." };
  }
  return {
    ok: true,
    connection: updated as ExternalCalendarConnection,
    reused,
  };
}
