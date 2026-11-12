import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const env = getSupabaseEnv();
  const url = env?.url ?? "https://placeholder.supabase.co";
  const key = env?.publishableKey ?? "public-anon-key";

  return createBrowserClient<Database>(url, key);
}
