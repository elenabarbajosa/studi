import type {
  ProviderCalendar,
  ProviderEvent,
  ProviderTokens,
  SyncFetchResult,
  SyncWindow,
} from "@/lib/calendar-sync/types";

export type CalendarProviderAdapter = {
  readonly id: "google" | "microsoft" | "icloud";
  listCalendars(tokens: ProviderTokens): Promise<ProviderCalendar[]>;
  /**
   * Fetch events for one calendar. Prefer incremental when syncToken/ctag present.
   * Must handle 410/invalid sync token by setting fullResyncRequired.
   */
  fetchEvents(
    tokens: ProviderTokens,
    calendar: {
      providerCalendarId: string;
      syncToken?: string | null;
      ctag?: string | null;
      /** When true, Microsoft uses /me/calendar/... instead of /me/calendars/{id}/... */
      isPrimary?: boolean;
    },
    window: SyncWindow,
  ): Promise<SyncFetchResult>;
  refreshTokens?(tokens: ProviderTokens): Promise<ProviderTokens>;
  /** Optional smoke test after connect — returns account label/email. */
  probeAccount?(
    tokens: ProviderTokens,
  ): Promise<{ accountLabel: string; accountEmail?: string; accountId?: string }>;
};

export type { ProviderCalendar, ProviderEvent, ProviderTokens, SyncFetchResult, SyncWindow };
