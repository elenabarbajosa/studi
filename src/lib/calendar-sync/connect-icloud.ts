import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getIcloudCalendarConfig } from "@/lib/calendar-sync/config";
import { upsertOwnedConnection } from "@/lib/calendar-sync/connection-upsert";
import { finalizeExternalConnection } from "@/lib/calendar-sync/finalize-connection";
import { connectIcloudWithAppPassword } from "@/lib/calendar-sync/providers/icloud";
import { safePublicError } from "@/lib/calendar-sync/safe-errors";
import type { createClient } from "@/lib/supabase/server";

export const icloudConnectSchema = z.object({
  appleIdEmail: z.string().email().max(320),
  appSpecificPassword: z.string().min(8).max(128),
});

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type IcloudConnectResult =
  | { ok: true; connectionId: string; success: string; reused: boolean }
  | { ok: false; error: string };

/**
 * Connect iCloud via CalDAV. Call only from trusted server routes — never log
 * `appSpecificPassword` or token payloads.
 *
 * Idempotent for the same user + Apple account: reuses pending/error/active
 * rows, refreshes encrypted credentials, and preserves calendars/events.
 */
export async function connectIcloudAccount(input: {
  supabase: Supabase;
  userId: string;
  appleIdEmail: string;
  appSpecificPassword: string;
}): Promise<IcloudConnectResult> {
  if (!getIcloudCalendarConfig().configured) {
    return {
      ok: false,
      error: `Setup required: ${getIcloudCalendarConfig().missing.join(", ")}`,
    };
  }

  const parsed = icloudConnectSchema.safeParse({
    appleIdEmail: input.appleIdEmail,
    appSpecificPassword: input.appSpecificPassword,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const connected = await connectIcloudWithAppPassword(parsed.data);

    const upserted = await upsertOwnedConnection(input.supabase, {
      userId: input.userId,
      provider: "icloud",
      providerAccountId: connected.accountId,
      accountLabel: connected.accountLabel,
      accountEmail: connected.accountEmail,
      scopes: ["caldav"],
    });
    if (!upserted.ok) {
      return { ok: false, error: upserted.error };
    }

    const finalized = await finalizeExternalConnection({
      supabase: input.supabase,
      connection: upserted.connection,
      tokens: connected,
      discoverOptions: { enablePrimaryOnly: false },
    });
    if (!finalized.ok) {
      return {
        ok: false,
        error:
          finalized.error ??
          "Could not finish iCloud setup. Check the password and try again.",
      };
    }

    revalidatePath("/calendar");
    revalidatePath("/planner");
    return {
      ok: true,
      connectionId: finalized.connectionId,
      reused: upserted.reused,
      success: upserted.reused
        ? "iCloud calendar reconnected."
        : "iCloud calendar connected.",
    };
  } catch (err) {
    return {
      ok: false,
      error: safePublicError(err, "iCloud connection failed."),
    };
  }
}
