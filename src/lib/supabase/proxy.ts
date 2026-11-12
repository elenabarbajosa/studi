import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "./env";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];
const RECOVERY_ROUTES = ["/reset-password"];
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/calendar",
  "/tasks",
  "/subjects",
  "/planner",
  "/focus",
  "/friends",
  "/study-together",
  "/statistics",
  "/settings",
  "/onboarding",
  "/u",
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) {
    return supabaseResponse;
  }

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh the auth token; required for persistent sessions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = matchesPrefix(pathname, AUTH_ROUTES);
  const isRecoveryRoute = matchesPrefix(pathname, RECOVERY_ROUTES);
  const isProtectedRoute = matchesPrefix(pathname, PROTECTED_PREFIXES);

  if (!user && (isProtectedRoute || isRecoveryRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (isProtectedRoute) {
      url.searchParams.set("next", pathname);
    }
    if (isRecoveryRoute) {
      url.searchParams.set("error", "recovery_required");
    }
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
