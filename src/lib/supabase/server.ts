import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

export async function createClient() {
  const env = getSupabaseEnv();
  const url = env?.url ?? "https://placeholder.supabase.co";
  const key = env?.publishableKey ?? "public-anon-key";

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies are read-only.
          // The proxy refreshes the session instead.
        }
      },
    },
  });
}
