import "server-only";

import { getGamificationPreferences } from "@/lib/data/progress";
import { resolveTimeZone } from "@/lib/event-time";

/** Browser field wins; profile timezone is the fallback when the field is missing. */
export async function timeZoneFromForm(formData: FormData): Promise<string> {
  const prefs = await getGamificationPreferences();
  return resolveTimeZone(formData.get("timezone"), prefs.timezone);
}

export async function timeZoneForUser(candidate?: unknown): Promise<string> {
  const prefs = await getGamificationPreferences();
  return resolveTimeZone(candidate, prefs.timezone);
}
