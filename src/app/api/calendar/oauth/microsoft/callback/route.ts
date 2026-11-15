import { NextResponse } from "next/server";

import { MICROSOFT_CALENDAR_SCOPES } from "@/lib/calendar-sync/config";
import { upsertOwnedConnection } from "@/lib/calendar-sync/connection-upsert";
import { finalizeExternalConnection } from "@/lib/calendar-sync/finalize-connection";
import { safeRedirectPath } from "@/lib/calendar-sync/oauth";
import { consumeCalendarOAuthState } from "@/lib/calendar-sync/oauth-store";
import { exchangeMicrosoftCode } from "@/lib/calendar-sync/providers/microsoft";
import { safePublicError } from "@/lib/calendar-sync/safe-errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  const fail = (message: string) =>
    NextResponse.redirect(
      `${origin}/calendar?calendar_connect=error&provider=microsoft&message=${encodeURIComponent(message)}`,
    );

  if (!isSupabaseConfigured()) return fail("Supabase is not configured.");
  if (oauthError) {
    if (/AADSTS65001|admin/i.test(oauthError)) {
      return fail(
        "Your school or work account requires admin approval before Outlook can connect to Studi.",
      );
    }
    return fail(
      safePublicError(oauthError, "Microsoft authorization was denied."),
    );
  }
  if (!code || !state) return fail("Missing OAuth code or state.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      `${origin}/login?next=${encodeURIComponent("/calendar")}`,
    );
  }

  let row: Awaited<ReturnType<typeof consumeCalendarOAuthState>>;
  try {
    row = await consumeCalendarOAuthState({ state, userId: user.id });
  } catch {
    return fail("Invalid or expired OAuth state.");
  }
  if (!row || row.provider !== "microsoft" || row.user_id !== user.id) {
    return fail("OAuth state validation failed.");
  }

  const redirectPath = safeRedirectPath(row.redirect_path);

  try {
    const tokens = await exchangeMicrosoftCode({
      code,
      codeVerifier: row.code_verifier,
    });

    const providerAccountId =
      tokens.accountId ?? tokens.email ?? `microsoft:${user.id}`;

    const upserted = await upsertOwnedConnection(supabase, {
      userId: user.id,
      provider: "microsoft",
      providerAccountId,
      accountLabel: tokens.name ?? tokens.email ?? "Outlook",
      accountEmail: tokens.email ?? null,
      scopes: [...MICROSOFT_CALENDAR_SCOPES],
    });
    if (!upserted.ok) return fail(upserted.error);

    const finalized = await finalizeExternalConnection({
      supabase,
      connection: upserted.connection,
      tokens,
      // First connect: sync the default calendar only; users can enable others.
      discoverOptions: { enablePrimaryOnly: true },
    });
    if (!finalized.ok) {
      return fail(
        finalized.error ?? "Connected but calendar sync test failed.",
      );
    }

    return NextResponse.redirect(
      `${origin}${redirectPath}${redirectPath.includes("?") ? "&" : "?"}calendar_connect=success&provider=microsoft`,
    );
  } catch (err) {
    return fail(safePublicError(err, "Microsoft connection failed."));
  }
}
