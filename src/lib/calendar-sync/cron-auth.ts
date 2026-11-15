/** Pure helpers for calendar sync cron authorization (unit-testable). */

export function authorizeCalendarCronRequest(
  request: { headers: { get(name: string): string | null } },
  secret: string | null | undefined,
): boolean {
  const expected = secret?.trim();
  if (!expected) return false;
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    "";
  return header === expected;
}
