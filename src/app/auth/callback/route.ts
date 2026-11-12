import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  const authError =
    searchParams.get("error_description") || searchParams.get("error");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }

  if (authError) {
    const message = encodeURIComponent(authError);
    return NextResponse.redirect(`${origin}/login?error=${message}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure a profile exists after OAuth / email confirmation.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, onboarding_status")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        if (
          profile.onboarding_status === "pending" ||
          profile.onboarding_status === "in_progress"
        ) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      if (safeNext === "/reset-password") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      return NextResponse.redirect(
        `${origin}${safeNext}${safeNext.includes("?") ? "&" : "?"}confirmed=1`,
      );
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
