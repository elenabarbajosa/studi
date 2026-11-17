import { resolveCalendarCronSecrets } from "@/lib/calendar-sync/cron-auth";
import type {
  ExternalCalendarProvider,
  ProviderConfigStatus,
} from "@/lib/calendar-sync/types";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

/** Env-only check (safe to import from server modules; does not load crypto). */
export function isCalendarSecretsKeyConfigured(): boolean {
  const raw = process.env.STUDI_CALENDAR_SECRETS_KEY?.trim();
  if (!raw) return false;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return true;
  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
}

/** Required for reading/writing encrypted tokens and OAuth state server-side. */
export function isServiceRoleKeyConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function pushSecretInfraMissing(missing: string[]) {
  if (!isCalendarSecretsKeyConfigured()) missing.push("STUDI_CALENDAR_SECRETS_KEY");
  if (!isServiceRoleKeyConfigured()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
}

export function calendarOAuthRedirectUri(
  provider: "google" | "microsoft",
): string {
  return `${siteUrl()}/api/calendar/oauth/${provider}/callback`;
}

export function getGoogleCalendarConfig(): ProviderConfigStatus & {
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
} {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_CALENDAR_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_CALENDAR_CLIENT_SECRET");
  pushSecretInfraMissing(missing);
  return {
    configured: missing.length === 0,
    missing,
    setupHint:
      "Create a Google Cloud OAuth client (Web) with Calendar API enabled, add the redirect URI, and set env vars.",
    clientId,
    clientSecret,
    redirectUri: calendarOAuthRedirectUri("google"),
  };
}

export function getMicrosoftCalendarConfig(): ProviderConfigStatus & {
  clientId?: string;
  clientSecret?: string;
  tenant: string;
  redirectUri: string;
} {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim();
  const tenant =
    process.env.MICROSOFT_CALENDAR_TENANT?.trim() || "common";
  const missing: string[] = [];
  if (!clientId) missing.push("MICROSOFT_CALENDAR_CLIENT_ID");
  if (!clientSecret) missing.push("MICROSOFT_CALENDAR_CLIENT_SECRET");
  pushSecretInfraMissing(missing);
  return {
    configured: missing.length === 0,
    missing,
    setupHint:
      "Register an Entra ID app (Accounts in any org + personal), add Calendars.Read, and set redirect URI + env vars.",
    clientId,
    clientSecret,
    tenant,
    redirectUri: calendarOAuthRedirectUri("microsoft"),
  };
}

export function getIcloudCalendarConfig(): ProviderConfigStatus {
  const missing: string[] = [];
  pushSecretInfraMissing(missing);
  return {
    configured: missing.length === 0,
    missing,
    setupHint:
      "iCloud uses CalDAV with an Apple app-specific password (never the main Apple Account password). Encryption key + service role required.",
  };
}

export function getIcsImportConfig(): ProviderConfigStatus {
  return {
    configured: true,
    missing: [],
    setupHint: "Manual .ics upload — no provider credentials required.",
  };
}

export function getProviderConfigStatus(
  provider: ExternalCalendarProvider,
): ProviderConfigStatus {
  switch (provider) {
    case "google":
      return getGoogleCalendarConfig();
    case "microsoft":
      return getMicrosoftCalendarConfig();
    case "icloud":
      return getIcloudCalendarConfig();
    case "ics":
      return getIcsImportConfig();
  }
}

/** True when Vercel `CRON_SECRET` and/or legacy calendar cron secret is set. */
export function getCronSecretConfigured(): boolean {
  return resolveCalendarCronSecrets(process.env).length > 0;
}

/** Secrets accepted by `/api/calendar/sync/cron` (never log these). */
export function getCalendarCronSecrets(): string[] {
  return resolveCalendarCronSecrets(process.env);
}

/** Google Calendar read-only scope (minimum for sync). */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
] as const;

/** Microsoft Graph least-privilege calendar read. */
export const MICROSOFT_CALENDAR_SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "Calendars.Read",
  "User.Read",
] as const;

export const ICS_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const ICS_MAX_EVENTS = 2000;
export const SYNC_LOOKBACK_DAYS = 30;
export const SYNC_LOOKAHEAD_DAYS = 180;
/** @deprecated Prefer SYNC_CRON_FETCH_BATCH from cron-runner — kept for imports. */
export const SYNC_BATCH_CONNECTIONS = 20;
