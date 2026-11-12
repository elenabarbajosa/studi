/**
 * Supports both the current Supabase dashboard name (`PUBLISHABLE_KEY`)
 * and the legacy name (`ANON_KEY`). Prefer publishable when both exist.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  return getSupabaseEnv() !== null;
}
