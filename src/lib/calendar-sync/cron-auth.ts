import { timingSafeEqual } from "node:crypto";

/** Pure helpers for calendar sync cron authorization (unit-testable). */

/**
 * Resolve acceptable cron secrets from env.
 * Production primary: Vercel `CRON_SECRET` (sent as Authorization Bearer).
 * Legacy: `CALENDAR_SYNC_CRON_SECRET` accepted only when set (manual schedulers).
 */
export function resolveCalendarCronSecrets(
  env: NodeJS.ProcessEnv | Record<string, string | undefined | null>,
): string[] {
  const out: string[] = [];
  const primary = env.CRON_SECRET?.trim();
  const legacy = env.CALENDAR_SYNC_CRON_SECRET?.trim();
  if (primary) out.push(primary);
  if (legacy && legacy !== primary) out.push(legacy);
  return out;
}

export function extractCalendarCronCredential(request: {
  headers: { get(name: string): string | null };
}): string {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) return bearer;
  return request.headers.get("x-cron-secret")?.trim() ?? "";
}

function secretsEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Authorize a cron invocation.
 * `secrets` may be a single string (legacy call sites/tests) or a list.
 * Missing/empty secrets always reject (never allow unauthenticated sync).
 */
export function authorizeCalendarCronRequest(
  request: { headers: { get(name: string): string | null } },
  secrets: string | readonly string[] | null | undefined,
): boolean {
  const list = Array.isArray(secrets)
    ? secrets.map((s) => s.trim()).filter(Boolean)
    : typeof secrets === "string" && secrets.trim()
      ? [secrets.trim()]
      : [];
  if (list.length === 0) return false;

  const provided = extractCalendarCronCredential(request);
  if (!provided) return false;

  return list.some((expected) => secretsEqual(expected, provided));
}
