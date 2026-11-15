import "server-only";

import {
  getGoogleCalendarConfig,
  GOOGLE_CALENDAR_SCOPES,
} from "@/lib/calendar-sync/config";
import { generateOAuthState, generatePkcePair } from "@/lib/calendar-sync/oauth";
import type { CalendarProviderAdapter } from "@/lib/calendar-sync/providers/types";
import { safeOAuthExchangeError } from "@/lib/calendar-sync/safe-errors";
import type {
  ProviderCalendar,
  ProviderEvent,
  ProviderTokens,
  SyncFetchResult,
  ExternalEventShowAs,
} from "@/lib/calendar-sync/types";
import { DEFAULT_SHOW_AS } from "@/lib/calendar-sync/types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

function mapTransparency(transparency?: string, status?: string): ExternalEventShowAs {
  if (status === "cancelled") return "free";
  if (transparency === "transparent") return "free";
  if (transparency === "opaque") return "busy";
  return DEFAULT_SHOW_AS;
}

function mapGoogleEvent(raw: Record<string, unknown>): ProviderEvent | null {
  const id = String(raw.id ?? "");
  if (!id) return null;
  const status = typeof raw.status === "string" ? raw.status : null;
  const start = raw.start as { dateTime?: string; date?: string; timeZone?: string } | undefined;
  const end = raw.end as { dateTime?: string; date?: string; timeZone?: string } | undefined;
  const allDay = Boolean(start?.date && !start?.dateTime);
  let startsAt: string;
  let endsAt: string | null;
  if (allDay && start?.date) {
    startsAt = `${start.date}T00:00:00.000Z`;
    endsAt = end?.date ? `${end.date}T00:00:00.000Z` : null;
  } else if (start?.dateTime) {
    startsAt = new Date(start.dateTime).toISOString();
    endsAt = end?.dateTime ? new Date(end.dateTime).toISOString() : null;
  } else {
    return null;
  }

  return {
    providerEventId: id,
    icalUid: typeof raw.iCalUID === "string" ? raw.iCalUID : null,
    recurrenceId:
      typeof raw.originalStartTime === "object" && raw.originalStartTime
        ? String(
            (raw.originalStartTime as { dateTime?: string; date?: string }).dateTime ??
              (raw.originalStartTime as { date?: string }).date ??
              "",
          ) || null
        : null,
    title: String(raw.summary ?? "(Untitled)").slice(0, 500),
    description:
      typeof raw.description === "string" ? raw.description.slice(0, 4000) : null,
    location: typeof raw.location === "string" ? raw.location.slice(0, 500) : null,
    startsAt,
    endsAt,
    allDay,
    timezone: start?.timeZone ?? end?.timeZone ?? null,
    showAs: mapTransparency(
      typeof raw.transparency === "string" ? raw.transparency : undefined,
      status ?? undefined,
    ),
    status,
    isCancelled: status === "cancelled",
    htmlLink: typeof raw.htmlLink === "string" ? raw.htmlLink : null,
    recurring: Array.isArray(raw.recurrence) || Boolean(raw.recurringEventId),
    providerUpdatedAt:
      typeof raw.updated === "string" ? new Date(raw.updated).toISOString() : null,
  };
}

export function buildGoogleAuthUrl(input: {
  state: string;
  codeChallenge: string;
}): string {
  const cfg = getGoogleCalendarConfig();
  if (!cfg.clientId) throw new Error("Google Calendar is not configured.");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function prepareGoogleOAuthStart(): Promise<{
  url: string;
  state: string;
  codeVerifier: string;
}> {
  const { verifier, challenge } = generatePkcePair();
  const state = generateOAuthState();
  return {
    url: buildGoogleAuthUrl({ state, codeChallenge: challenge }),
    state,
    codeVerifier: verifier,
  };
}

export async function exchangeGoogleCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<ProviderTokens & { email?: string; accountId?: string }> {
  const cfg = getGoogleCalendarConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("Google Calendar is not configured.");
  }
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      safeOAuthExchangeError(
        "Google",
        typeof json.error === "string" ? json.error : null,
        typeof json.error_description === "string"
          ? json.error_description
          : null,
      ),
    );
  }
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new Error("Google did not return an access token.");
  const expiresIn = Number(json.expires_in ?? 3600);
  const tokens: ProviderTokens & { email?: string; accountId?: string } = {
    accessToken,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    tokenType: typeof json.token_type === "string" ? json.token_type : "Bearer",
    scope: typeof json.scope === "string" ? json.scope : null,
  };

  // Optional identity from id_token / userinfo
  try {
    const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (u.ok) {
      const profile = (await u.json()) as { email?: string; sub?: string; name?: string };
      tokens.email = profile.email;
      tokens.accountId = profile.sub;
    }
  } catch {
    // non-fatal
  }
  return tokens;
}

async function refreshGoogleTokens(tokens: ProviderTokens): Promise<ProviderTokens> {
  if (!tokens.refreshToken) {
    throw new Error("Google refresh token missing — reconnect required.");
  }
  const cfg = getGoogleCalendarConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("Google Calendar is not configured.");
  }
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      safeOAuthExchangeError(
        "Google",
        typeof json.error === "string" ? json.error : "refresh_failed",
        typeof json.error_description === "string"
          ? json.error_description
          : null,
      ),
    );
    (err as Error & { code?: string }).code = "needs_reauth";
    throw err;
  }
  const accessToken = String(json.access_token ?? "");
  const expiresIn = Number(json.expires_in ?? 3600);
  return {
    ...tokens,
    accessToken,
    // Google may omit refresh_token on refresh — keep previous.
    refreshToken:
      typeof json.refresh_token === "string" ? json.refresh_token : tokens.refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: typeof json.scope === "string" ? json.scope : tokens.scope,
  };
}

async function googleFetch(
  tokens: ProviderTokens,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  });
}

export const googleCalendarProvider: CalendarProviderAdapter = {
  id: "google",

  async probeAccount(tokens) {
    const res = await googleFetch(tokens, "/users/me/calendarList?maxResults=1");
    if (res.status === 401 || res.status === 403) {
      const err = new Error("Google Calendar authorization failed.");
      (err as Error & { code?: string }).code = "needs_reauth";
      throw err;
    }
    if (!res.ok) {
      throw new Error(`Google Calendar probe failed (${res.status}).`);
    }
    // Prefer OpenID profile when available via a lightweight calendarList owner
    const list = (await res.json()) as {
      items?: Array<{ id?: string; summary?: string }>;
    };
    const primary = list.items?.[0];
    return {
      accountLabel: primary?.summary ?? "Google Calendar",
      accountEmail: primary?.id?.includes("@") ? primary.id : undefined,
      accountId: primary?.id,
    };
  },

  async listCalendars(tokens) {
    const calendars: ProviderCalendar[] = [];
    let pageToken: string | undefined;
    do {
      const qs = new URLSearchParams({ maxResults: "250" });
      if (pageToken) qs.set("pageToken", pageToken);
      const res = await googleFetch(tokens, `/users/me/calendarList?${qs}`);
      if (res.status === 401) {
        const err = new Error("Google authorization expired.");
        (err as Error & { code?: string }).code = "needs_reauth";
        throw err;
      }
      if (!res.ok) throw new Error(`Failed to list Google calendars (${res.status}).`);
      const json = (await res.json()) as {
        items?: Array<Record<string, unknown>>;
        nextPageToken?: string;
      };
      for (const item of json.items ?? []) {
        const id = String(item.id ?? "");
        if (!id) continue;
        calendars.push({
          id,
          name: String(item.summary ?? id),
          color:
            typeof item.backgroundColor === "string" ? item.backgroundColor : null,
          timezone: typeof item.timeZone === "string" ? item.timeZone : null,
          isPrimary: item.primary === true,
        });
      }
      pageToken = json.nextPageToken;
    } while (pageToken);
    return calendars;
  },

  async fetchEvents(tokens, calendar, window): Promise<SyncFetchResult> {
    const events: ProviderEvent[] = [];
    const deletedProviderEventIds: string[] = [];
    const syncToken = calendar.syncToken ?? undefined;
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;

    // Google: when syncToken is set, do not combine with timeMin/timeMax/etc.
    const runPage = async () => {
      const qs = new URLSearchParams({
        maxResults: "250",
        singleEvents: "true",
        showDeleted: "true",
      });
      if (syncToken) {
        qs.set("syncToken", syncToken);
      } else {
        qs.set("timeMin", window.timeMin);
        qs.set("timeMax", window.timeMax);
        qs.set("orderBy", "startTime");
      }
      if (pageToken) qs.set("pageToken", pageToken);

      const path = `/calendars/${encodeURIComponent(calendar.providerCalendarId)}/events?${qs}`;
      const res = await googleFetch(tokens, path);
      if (res.status === 410) {
        return { fullResyncRequired: true as const };
      }
      if (res.status === 401) {
        const err = new Error("Google authorization expired.");
        (err as Error & { code?: string }).code = "needs_reauth";
        throw err;
      }
      if (!res.ok) {
        throw new Error(`Google events fetch failed (${res.status}).`);
      }
      const json = (await res.json()) as {
        items?: Array<Record<string, unknown>>;
        nextPageToken?: string;
        nextSyncToken?: string;
      };
      for (const item of json.items ?? []) {
        if (item.status === "cancelled") {
          const id = String(item.id ?? "");
          if (id) deletedProviderEventIds.push(id);
          const mapped = mapGoogleEvent(item);
          if (mapped) events.push(mapped);
          continue;
        }
        const mapped = mapGoogleEvent(item);
        if (mapped) events.push(mapped);
      }
      pageToken = json.nextPageToken;
      if (json.nextSyncToken) nextSyncToken = json.nextSyncToken;
      return null;
    };

    // First attempt (may 410)
    const first = await runPage();
    if (first?.fullResyncRequired) {
      return { events: [], deletedProviderEventIds: [], fullResyncRequired: true };
    }
    while (pageToken) {
      const again = await runPage();
      if (again?.fullResyncRequired) {
        return { events: [], deletedProviderEventIds: [], fullResyncRequired: true };
      }
    }

    return { events, deletedProviderEventIds, nextSyncToken };
  },

  refreshTokens: refreshGoogleTokens,
};
