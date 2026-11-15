import "server-only";

import {
  getMicrosoftCalendarConfig,
  MICROSOFT_CALENDAR_SCOPES,
} from "@/lib/calendar-sync/config";
import { generateOAuthState, generatePkcePair } from "@/lib/calendar-sync/oauth";
import {
  buildOutlookCalendarViewPath,
  buildOutlookEventsDeltaPath,
  formatOutlookGraphError,
  parseGraphErrorBody,
} from "@/lib/calendar-sync/microsoft-graph";
import type { CalendarProviderAdapter } from "@/lib/calendar-sync/providers/types";
import { safeOAuthExchangeError } from "@/lib/calendar-sync/safe-errors";
import type {
  ExternalEventShowAs,
  ProviderCalendar,
  ProviderEvent,
  ProviderTokens,
  SyncFetchResult,
} from "@/lib/calendar-sync/types";
import { DEFAULT_SHOW_AS } from "@/lib/calendar-sync/types";

const GRAPH = "https://graph.microsoft.com/v1.0";

async function graphError(
  operation: string,
  res: Response,
): Promise<Error> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const info = parseGraphErrorBody(res.status, body);
  const err = new Error(formatOutlookGraphError(operation, info));
  (err as Error & { code?: string; graphCode?: string }).graphCode = info.code;
  if (res.status === 401) {
    (err as Error & { code?: string }).code = "needs_reauth";
  }
  return err;
}

function authBase(tenant: string) {
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
}

function mapShowAs(raw?: string): ExternalEventShowAs {
  switch ((raw ?? "").toLowerCase()) {
    case "free":
      return "free";
    case "tentative":
      return "tentative";
    case "oof":
    case "workingelsewhere":
      return "oof";
    case "busy":
      return "busy";
    default:
      return DEFAULT_SHOW_AS;
  }
}

function mapGraphEvent(raw: Record<string, unknown>): ProviderEvent | null {
  const id = String(raw.id ?? "");
  if (!id) return null;
  const start = raw.start as { dateTime?: string; timeZone?: string } | undefined;
  const end = raw.end as { dateTime?: string; timeZone?: string } | undefined;
  const isAllDay = raw.isAllDay === true;
  if (!start?.dateTime) return null;

  // Graph returns local wall time without Z — append Z when timezone is UTC,
  // otherwise parse as ISO if Z/offset present, else treat as UTC wall (best-effort).
  const toIso = (dt: string) => {
    if (/Z$|[+-]\d{2}:\d{2}$/.test(dt)) return new Date(dt).toISOString();
    return new Date(`${dt}Z`).toISOString();
  };

  const startsAt = isAllDay
    ? `${start.dateTime.slice(0, 10)}T00:00:00.000Z`
    : toIso(start.dateTime);
  const endsAt = end?.dateTime
    ? isAllDay
      ? `${end.dateTime.slice(0, 10)}T00:00:00.000Z`
      : toIso(end.dateTime)
    : null;

  const isCancelled = raw.isCancelled === true;
  return {
    providerEventId: id,
    icalUid: typeof raw.iCalUId === "string" ? raw.iCalUId : null,
    recurrenceId: null,
    title: String(raw.subject ?? "(Untitled)").slice(0, 500),
    description:
      typeof raw.bodyPreview === "string" ? raw.bodyPreview.slice(0, 4000) : null,
    location:
      typeof (raw.location as { displayName?: string } | undefined)?.displayName ===
      "string"
        ? String((raw.location as { displayName: string }).displayName).slice(0, 500)
        : null,
    startsAt,
    endsAt,
    allDay: isAllDay,
    timezone: start.timeZone ?? null,
    showAs: isCancelled ? "free" : mapShowAs(typeof raw.showAs === "string" ? raw.showAs : undefined),
    status: isCancelled ? "cancelled" : typeof raw.showAs === "string" ? raw.showAs : null,
    isCancelled,
    htmlLink: typeof raw.webLink === "string" ? raw.webLink : null,
    recurring: Boolean(raw.recurrence) || typeof raw.seriesMasterId === "string",
    providerUpdatedAt:
      typeof raw.lastModifiedDateTime === "string"
        ? new Date(raw.lastModifiedDateTime).toISOString()
        : null,
  };
}

export function buildMicrosoftAuthUrl(input: {
  state: string;
  codeChallenge: string;
}): string {
  const cfg = getMicrosoftCalendarConfig();
  if (!cfg.clientId) throw new Error("Microsoft Calendar is not configured.");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    response_mode: "query",
    scope: MICROSOFT_CALENDAR_SCOPES.join(" "),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${authBase(cfg.tenant)}/authorize?${params.toString()}`;
}

export async function prepareMicrosoftOAuthStart(): Promise<{
  url: string;
  state: string;
  codeVerifier: string;
}> {
  const { verifier, challenge } = generatePkcePair();
  const state = generateOAuthState();
  return {
    url: buildMicrosoftAuthUrl({ state, codeChallenge: challenge }),
    state,
    codeVerifier: verifier,
  };
}

export async function exchangeMicrosoftCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<ProviderTokens & { email?: string; accountId?: string; name?: string }> {
  const cfg = getMicrosoftCalendarConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("Microsoft Calendar is not configured.");
  }
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: input.code,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
    scope: MICROSOFT_CALENDAR_SCOPES.join(" "),
  });
  const res = await fetch(`${authBase(cfg.tenant)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof json.error === "string" ? json.error : "";
    const desc =
      typeof json.error_description === "string"
        ? json.error_description
        : null;
    const err = new Error(safeOAuthExchangeError("Microsoft", code, desc));
    if (desc && /AADSTS65001|admin/i.test(desc)) {
      (err as Error & { code?: string }).code = "admin_consent";
    }
    throw err;
  }
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new Error("Microsoft did not return an access token.");
  const expiresIn = Number(json.expires_in ?? 3600);
  const tokens: ProviderTokens & { email?: string; accountId?: string; name?: string } = {
    accessToken,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    tokenType: typeof json.token_type === "string" ? json.token_type : "Bearer",
    scope: typeof json.scope === "string" ? json.scope : null,
  };

  try {
    const me = await fetch(`${GRAPH}/me?$select=id,displayName,mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (me.ok) {
      const profile = (await me.json()) as {
        id?: string;
        displayName?: string;
        mail?: string;
        userPrincipalName?: string;
      };
      tokens.accountId = profile.id;
      tokens.name = profile.displayName;
      tokens.email = profile.mail ?? profile.userPrincipalName;
    }
  } catch {
    // non-fatal
  }
  return tokens;
}

async function refreshMicrosoftTokens(tokens: ProviderTokens): Promise<ProviderTokens> {
  if (!tokens.refreshToken) {
    const err = new Error("Microsoft refresh token missing — reconnect required.");
    (err as Error & { code?: string }).code = "needs_reauth";
    throw err;
  }
  const cfg = getMicrosoftCalendarConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("Microsoft Calendar is not configured.");
  }
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
    scope: MICROSOFT_CALENDAR_SCOPES.join(" "),
  });
  const res = await fetch(`${authBase(cfg.tenant)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      safeOAuthExchangeError(
        "Microsoft",
        typeof json.error === "string" ? json.error : "refresh_failed",
        typeof json.error_description === "string"
          ? json.error_description
          : null,
      ),
    );
    (err as Error & { code?: string }).code = "needs_reauth";
    throw err;
  }
  const expiresIn = Number(json.expires_in ?? 3600);
  return {
    ...tokens,
    accessToken: String(json.access_token ?? ""),
    refreshToken:
      typeof json.refresh_token === "string" ? json.refresh_token : tokens.refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: typeof json.scope === "string" ? json.scope : tokens.scope,
  };
}

async function graphFetch(tokens: ProviderTokens, path: string, init?: RequestInit) {
  return fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Prefer: 'outlook.timezone="UTC"',
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  });
}

export const microsoftCalendarProvider: CalendarProviderAdapter = {
  id: "microsoft",

  async probeAccount(tokens) {
    const res = await graphFetch(
      tokens,
      "/me?$select=id,displayName,mail,userPrincipalName",
    );
    if (res.status === 401) {
      const err = new Error("Microsoft authorization expired.");
      (err as Error & { code?: string }).code = "needs_reauth";
      throw err;
    }
    if (res.status === 403) {
      const err = new Error(
        "Microsoft Graph denied calendar access. Your institution may require admin approval.",
      );
      (err as Error & { code?: string }).code = "admin_consent";
      throw err;
    }
    if (!res.ok) throw new Error(`Microsoft probe failed (${res.status}).`);
    const profile = (await res.json()) as {
      id?: string;
      displayName?: string;
      mail?: string;
      userPrincipalName?: string;
    };
    return {
      accountLabel: profile.displayName ?? profile.mail ?? "Microsoft account",
      accountEmail: profile.mail ?? profile.userPrincipalName,
      accountId: profile.id,
    };
  },

  async listCalendars(tokens) {
    const calendars: ProviderCalendar[] = [];
    let url: string | null =
      "/me/calendars?$top=100&$select=id,name,color,isDefaultCalendar,hexColor,canEdit";
    while (url) {
      const res = await graphFetch(
        tokens,
        url.startsWith("http") ? url.replace(GRAPH, "") : url,
      );
      if (res.status === 401) {
        const err = new Error("Microsoft authorization expired.");
        (err as Error & { code?: string }).code = "needs_reauth";
        throw err;
      }
      if (!res.ok) throw await graphError("List Outlook calendars", res);
      const json = (await res.json()) as {
        value?: Array<Record<string, unknown>>;
        "@odata.nextLink"?: string;
      };
      for (const item of json.value ?? []) {
        const id = String(item.id ?? "");
        if (!id) continue;
        calendars.push({
          id,
          name: String(item.name ?? "Calendar"),
          color:
            typeof item.hexColor === "string"
              ? item.hexColor
              : typeof item.color === "string"
                ? item.color
                : null,
          timezone: null,
          isPrimary: item.isDefaultCalendar === true,
        });
      }
      url = json["@odata.nextLink"]
        ? json["@odata.nextLink"].replace(GRAPH, "")
        : null;
    }
    // Ensure at least one primary marker when Graph omits isDefaultCalendar.
    if (calendars.length > 0 && !calendars.some((c) => c.isPrimary)) {
      calendars[0]!.isPrimary = true;
    }
    return calendars;
  },

  async fetchEvents(tokens, calendar, window): Promise<SyncFetchResult> {
    const events: ProviderEvent[] = [];
    const deletedProviderEventIds: string[] = [];
    const isDefault = calendar.isPrimary === true;

    // Delta sync when we have a stored delta link in syncToken.
    if (
      calendar.syncToken?.includes("/delta") ||
      calendar.syncToken?.startsWith("https://")
    ) {
      let url = calendar.syncToken.startsWith("http")
        ? calendar.syncToken.replace(GRAPH, "")
        : calendar.syncToken;
      let deltaLink: string | null = null;
      while (url) {
        const res = await graphFetch(tokens, url);
        if (res.status === 410) {
          return {
            events: [],
            deletedProviderEventIds: [],
            fullResyncRequired: true,
          };
        }
        if (!res.ok) throw await graphError("Outlook delta sync", res);
        const json = (await res.json()) as {
          value?: Array<Record<string, unknown>>;
          "@odata.nextLink"?: string;
          "@odata.deltaLink"?: string;
        };
        for (const item of json.value ?? []) {
          if (item["@removed"]) {
            const id = String(item.id ?? "");
            if (id) deletedProviderEventIds.push(id);
            continue;
          }
          const mapped = mapGraphEvent(item);
          if (mapped) events.push(mapped);
        }
        if (json["@odata.nextLink"]) {
          url = json["@odata.nextLink"].replace(GRAPH, "");
        } else {
          deltaLink = json["@odata.deltaLink"] ?? null;
          url = "";
        }
      }
      return {
        events,
        deletedProviderEventIds,
        nextSyncToken: deltaLink,
      };
    }

    // Initial: calendarView expands occurrences (documented v1.0).
    // Default calendar uses /me/calendar/calendarView — avoids id encoding pitfalls.
    let url: string | null = buildOutlookCalendarViewPath({
      providerCalendarId: calendar.providerCalendarId,
      isDefaultCalendar: isDefault,
      timeMin: window.timeMin,
      timeMax: window.timeMax,
    });

    while (url) {
      const res = await graphFetch(tokens, url);
      if (!res.ok) {
        // Fallback: if default-calendar shortcut 404s, try id-based path once.
        if (
          isDefault &&
          res.status === 404 &&
          url.startsWith("/me/calendar/calendarView")
        ) {
          url = buildOutlookCalendarViewPath({
            providerCalendarId: calendar.providerCalendarId,
            isDefaultCalendar: false,
            timeMin: window.timeMin,
            timeMax: window.timeMax,
          });
          continue;
        }
        throw await graphError("Outlook calendar view", res);
      }
      const json = (await res.json()) as {
        value?: Array<Record<string, unknown>>;
        "@odata.nextLink"?: string;
      };
      for (const item of json.value ?? []) {
        const mapped = mapGraphEvent(item);
        if (mapped) events.push(mapped);
      }
      url = json["@odata.nextLink"]
        ? json["@odata.nextLink"].replace(GRAPH, "")
        : null;
    }

    // Seed delta link for next incremental sync (optional).
    let nextSyncToken: string | null = null;
    try {
      const deltaRes = await graphFetch(
        tokens,
        buildOutlookEventsDeltaPath({
          providerCalendarId: calendar.providerCalendarId,
          isDefaultCalendar: isDefault,
        }),
      );
      if (deltaRes.ok) {
        const deltaJson = (await deltaRes.json()) as {
          "@odata.deltaLink"?: string;
          "@odata.nextLink"?: string;
        };
        let next = deltaJson["@odata.nextLink"];
        let link = deltaJson["@odata.deltaLink"] ?? null;
        while (next && !link) {
          const r = await graphFetch(tokens, next.replace(GRAPH, ""));
          if (!r.ok) break;
          const j = (await r.json()) as {
            "@odata.deltaLink"?: string;
            "@odata.nextLink"?: string;
          };
          link = j["@odata.deltaLink"] ?? null;
          next = j["@odata.nextLink"];
        }
        nextSyncToken = link;
      }
    } catch {
      // Incremental optional on first sync
    }

    return { events, deletedProviderEventIds, nextSyncToken };
  },

  refreshTokens: refreshMicrosoftTokens,
};
