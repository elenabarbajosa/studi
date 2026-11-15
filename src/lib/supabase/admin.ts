import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Privileged Supabase client (service role). Server-only.
 * Used for encrypted calendar secrets and OAuth state — never expose to the browser.
 */
export function isServiceRoleConfigured(): boolean {
  return Boolean(
    getSupabaseEnv() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function createServiceRoleClient() {
  const env = getSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!env || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for secure calendar credential access.",
    );
  }
  return createClient<Database>(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
