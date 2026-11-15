/** Shared types for external calendar integrations (provider-independent). */

export type ExternalCalendarProvider = "google" | "microsoft" | "icloud" | "ics";

export type ExternalConnectionStatus =
  | "pending"
  | "active"
  | "needs_reauth"
  | "error"
  | "disconnected";

export type ExternalEventShowAs =
  | "busy"
  | "free"
  | "tentative"
  | "oof"
  | "unknown";

export type ExternalEventLinkKind = "assessment" | "task" | "ignored";

/** Default when provider omits free/busy: treat as busy (conservative for study planning). */
export const DEFAULT_SHOW_AS: ExternalEventShowAs = "busy";

export type ProviderCalendar = {
  id: string;
  name: string;
  color?: string | null;
  timezone?: string | null;
  isPrimary?: boolean;
};

export type ProviderEvent = {
  providerEventId: string;
  icalUid?: string | null;
  recurrenceId?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  timezone?: string | null;
  showAs: ExternalEventShowAs;
  status?: string | null;
  isCancelled: boolean;
  htmlLink?: string | null;
  recurring?: boolean;
  providerUpdatedAt?: string | null;
};

export type SyncWindow = {
  timeMin: string;
  timeMax: string;
};

export type SyncFetchResult = {
  events: ProviderEvent[];
  deletedProviderEventIds: string[];
  nextSyncToken?: string | null;
  nextCtag?: string | null;
  fullResyncRequired?: boolean;
};

export type ProviderTokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  /** iCloud CalDAV only — Apple Account email + app-specific password. */
  caldavUsername?: string | null;
  caldavPassword?: string | null;
  caldavPrincipalUrl?: string | null;
  caldavHomeUrl?: string | null;
};

export type EncryptedSecretBlob = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

export type ExternalCalendarConnection = {
  id: string;
  user_id: string;
  provider: ExternalCalendarProvider;
  status: ExternalConnectionStatus;
  account_label: string | null;
  account_email: string | null;
  provider_account_id: string | null;
  scopes: string[];
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  last_sync_error: string | null;
  sync_cursor: string | null;
  dedupe_fingerprint: string | null;
  created_at: string;
  updated_at: string;
};

export type ExternalCalendar = {
  id: string;
  user_id: string;
  connection_id: string;
  provider_calendar_id: string;
  name: string;
  color: string | null;
  timezone: string | null;
  enabled: boolean;
  is_primary: boolean;
  sync_token: string | null;
  ctag: string | null;
  etag: string | null;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ExternalCalendarEvent = {
  id: string;
  user_id: string;
  connection_id: string;
  calendar_id: string;
  provider_event_id: string;
  ical_uid: string | null;
  recurrence_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone: string | null;
  show_as: ExternalEventShowAs;
  status: string | null;
  is_cancelled: boolean;
  html_link: string | null;
  recurring: boolean;
  provider_updated_at: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type ExternalEventLink = {
  id: string;
  user_id: string;
  external_event_id: string;
  kind: ExternalEventLinkKind;
  assessment_id: string | null;
  task_id: string | null;
  proposed_title: string | null;
  proposed_type: string | null;
  source_fingerprint: string | null;
  created_at: string;
  updated_at: string;
};

export type ProviderConfigStatus = {
  configured: boolean;
  missing: string[];
  setupHint: string;
};
