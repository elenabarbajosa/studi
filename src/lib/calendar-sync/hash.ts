import { createHash } from "node:crypto";

import type { ProviderEvent } from "@/lib/calendar-sync/types";

export function contentHashForEvent(event: ProviderEvent): string {
  const payload = [
    event.providerEventId,
    event.icalUid ?? "",
    event.recurrenceId ?? "",
    event.title,
    event.description ?? "",
    event.location ?? "",
    event.startsAt,
    event.endsAt ?? "",
    event.allDay ? "1" : "0",
    event.showAs,
    event.isCancelled ? "1" : "0",
    event.status ?? "",
  ].join("\u0000");
  return createHash("sha256").update(payload).digest("hex").slice(0, 40);
}

/** Fingerprint for detecting the same calendar connected via multiple providers. */
export function dedupeFingerprint(parts: {
  icalUid?: string | null;
  title: string;
  startsAt: string;
  endsAt: string | null;
}): string {
  const payload = [
    (parts.icalUid ?? "").toLowerCase().trim(),
    parts.title.trim().toLowerCase(),
    parts.startsAt,
    parts.endsAt ?? "",
  ].join("\u0000");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}
