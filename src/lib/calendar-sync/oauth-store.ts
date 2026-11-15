import "server-only";

import type { ExternalCalendarProvider } from "@/lib/calendar-sync/types";
import {
  assertOAuthStateExpiry,
  safeRedirectPath,
} from "@/lib/calendar-sync/oauth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export { assertOAuthStateExpiry };

export async function storeCalendarOAuthState(input: {
  userId: string;
  provider: Extract<ExternalCalendarProvider, "google" | "microsoft">;
  state: string;
  codeVerifier: string;
  redirectPath: string;
  expiresAt: string;
}): Promise<void> {
  if (input.state.length < 16 || input.state.length > 256) {
    throw new Error("Invalid OAuth state.");
  }
  if (input.codeVerifier.length < 32 || input.codeVerifier.length > 256) {
    throw new Error("Invalid OAuth code verifier.");
  }
  const redirectPath = safeRedirectPath(input.redirectPath);
  assertOAuthStateExpiry(input.expiresAt);

  const admin = createServiceRoleClient();
  const { error: deleteError } = await admin
    .from("calendar_oauth_states")
    .delete()
    .eq("user_id", input.userId)
    .eq("provider", input.provider);
  if (deleteError) {
    throw new Error("Could not reset OAuth state.");
  }

  const createdAt = new Date().toISOString();
  const { error } = await admin.from("calendar_oauth_states").insert({
    user_id: input.userId,
    provider: input.provider,
    state: input.state,
    code_verifier: input.codeVerifier,
    redirect_path: redirectPath,
    expires_at: input.expiresAt,
    created_at: createdAt,
  });
  if (error) {
    const code = error.code ?? "unknown";
    throw new Error(`Could not store OAuth state (${code}).`);
  }
}

export async function consumeCalendarOAuthState(input: {
  state: string;
  userId: string;
}): Promise<{
  id: string;
  user_id: string;
  provider: ExternalCalendarProvider;
  code_verifier: string;
  redirect_path: string;
} | null> {
  if (!input.state || input.state.length > 256) return null;
  const admin = createServiceRoleClient();

  // Single-use: delete matching non-expired row for this user only.
  const { data, error } = await admin
    .from("calendar_oauth_states")
    .delete()
    .eq("state", input.state)
    .eq("user_id", input.userId)
    .gt("expires_at", new Date().toISOString())
    .select("id, user_id, provider, code_verifier, redirect_path")
    .maybeSingle();

  if (error) throw new Error("OAuth state validation failed.");
  return data;
}
