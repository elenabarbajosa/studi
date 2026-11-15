import { NextResponse } from "next/server";

import { getGoogleCalendarConfig } from "@/lib/calendar-sync/config";
import { oauthStateExpiresAt, safeRedirectPath } from "@/lib/calendar-sync/oauth";
import { storeCalendarOAuthState } from "@/lib/calendar-sync/oauth-store";
import { prepareGoogleOAuthStart } from "@/lib/calendar-sync/providers/google";
import { safePublicError } from "@/lib/calendar-sync/safe-errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const next = safeRedirectPath(url.searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${origin}/calendar?calendar_connect=error&message=${encodeURIComponent("Supabase is not configured.")}`,
    );
  }

  const cfg = getGoogleCalendarConfig();
  if (!cfg.configured) {
    return NextResponse.redirect(
      `${origin}/calendar?calendar_connect=setup&provider=google&message=${encodeURIComponent(`Setup required: ${cfg.missing.join(", ")}`)}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      `${origin}/login?next=${encodeURIComponent("/calendar")}`,
    );
  }

  try {
    const prepared = await prepareGoogleOAuthStart();
    await storeCalendarOAuthState({
      userId: user.id,
      provider: "google",
      state: prepared.state,
      codeVerifier: prepared.codeVerifier,
      redirectPath: next,
      expiresAt: oauthStateExpiresAt(10),
    });
    return NextResponse.redirect(prepared.url);
  } catch (err) {
    const message = safePublicError(err, "Could not start Google connection.");
    return NextResponse.redirect(
      `${origin}/calendar?calendar_connect=error&message=${encodeURIComponent(message)}`,
    );
  }
}
