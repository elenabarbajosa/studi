import { NextResponse } from "next/server";

import { connectIcloudAccount } from "@/lib/calendar-sync/connect-icloud";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * iCloud CalDAV connect endpoint.
 * Uses a Route Handler (not a Server Action) so app-specific passwords are not
 * printed in Next.js development Server Function argument traces.
 * Request bodies are never logged here.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const appleIdEmail =
    "appleIdEmail" in body && typeof body.appleIdEmail === "string"
      ? body.appleIdEmail
      : "";
  const appSpecificPassword =
    "appSpecificPassword" in body && typeof body.appSpecificPassword === "string"
      ? body.appSpecificPassword
      : "";

  const result = await connectIcloudAccount({
    supabase,
    userId: user.id,
    appleIdEmail,
    appSpecificPassword,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    connectionId: result.connectionId,
    success: result.success,
  });
}
