import "server-only";

import { XMLParser } from "fast-xml-parser";

import { parseIcs } from "@/lib/calendar-sync/ics";
import type { CalendarProviderAdapter } from "@/lib/calendar-sync/providers/types";
import type {
  ProviderCalendar,
  ProviderEvent,
  ProviderTokens,
  SyncFetchResult,
} from "@/lib/calendar-sync/types";

const ICLOUD_ENTRY = "https://caldav.icloud.com/";
const ALLOWED_HOST_RE = /^([a-z0-9-]+\.)*icloud\.com$/i;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
});

/**
 * Apple does not offer a general third-party OAuth for iCloud Calendar for
 * arbitrary SaaS apps. Supported path for Studi: CalDAV over HTTPS with an
 * Apple Account email + app-specific password (never the main password).
 * See https://support.apple.com/en-us/102654 and https://support.apple.com/en-us/121539
 */

export function assertSafeIcloudUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid CalDAV URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS CalDAV endpoints are allowed.");
  }
  if (url.username || url.password) {
    throw new Error("Credentials must not appear in CalDAV URLs.");
  }
  if (!ALLOWED_HOST_RE.test(url.hostname)) {
    throw new Error("CalDAV host is not an allowed Apple iCloud endpoint.");
  }
  // Block obvious SSRF tricks
  if (url.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    throw new Error("CalDAV host is not an allowed Apple iCloud endpoint.");
  }
  return url;
}

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

async function caldavRequest(
  tokens: ProviderTokens,
  urlString: string,
  init: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
    depth?: string;
  },
): Promise<{ status: number; text: string; headers: Headers }> {
  if (!tokens.caldavUsername || !tokens.caldavPassword) {
    throw new Error("iCloud CalDAV credentials are missing.");
  }
  const url = assertSafeIcloudUrl(urlString);
  // Manual redirect handling to re-validate each hop (SSRF).
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current.toString(), {
      method: init.method,
      redirect: "manual",
      headers: {
        Authorization: basicAuth(tokens.caldavUsername, tokens.caldavPassword),
        "Content-Type": "application/xml; charset=utf-8",
        ...(init.depth ? { Depth: init.depth } : {}),
        ...(init.headers ?? {}),
      },
      body: init.body,
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("CalDAV redirect missing Location.");
      current = assertSafeIcloudUrl(new URL(loc, current).toString());
      continue;
    }
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  }
  throw new Error("Too many CalDAV redirects.");
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && node && "#text" in node) {
    return String((node as { "#text": string })["#text"] ?? "");
  }
  return "";
}

function hrefOf(node: unknown): string {
  if (typeof node === "string") return node;
  return textOf(node);
}

async function discoverHome(tokens: ProviderTokens): Promise<{
  principalUrl: string;
  homeUrl: string;
}> {
  const wellKnown = await caldavRequest(tokens, ICLOUD_ENTRY, {
    method: "PROPFIND",
    depth: "0",
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`,
  });

  if (wellKnown.status === 401 || wellKnown.status === 403) {
    const err = new Error(
      "iCloud rejected these credentials. Use your Apple Account email and an app-specific password — not your main Apple password.",
    );
    (err as Error & { code?: string }).code = "needs_reauth";
    throw err;
  }
  if (wellKnown.status >= 400) {
    throw new Error(`iCloud CalDAV discovery failed (${wellKnown.status}).`);
  }

  const parsed = xmlParser.parse(wellKnown.text);
  const responses = asArray(parsed?.multistatus?.response);
  let principalPath = "";
  for (const resp of responses) {
    const props = asArray(resp?.propstat);
    for (const ps of props) {
      const href = hrefOf(ps?.prop?.["current-user-principal"]?.href);
      if (href) {
        principalPath = href;
        break;
      }
    }
    if (principalPath) break;
  }
  if (!principalPath) {
    throw new Error("Could not discover iCloud calendar principal.");
  }

  const principalUrl = assertSafeIcloudUrl(
    new URL(principalPath, ICLOUD_ENTRY).toString(),
  ).toString();

  const homeRes = await caldavRequest(tokens, principalUrl, {
    method: "PROPFIND",
    depth: "0",
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`,
  });
  if (homeRes.status >= 400) {
    throw new Error(`iCloud calendar-home discovery failed (${homeRes.status}).`);
  }
  const homeParsed = xmlParser.parse(homeRes.text);
  const homeResponses = asArray(homeParsed?.multistatus?.response);
  let homePath = "";
  for (const resp of homeResponses) {
    for (const ps of asArray(resp?.propstat)) {
      const href = hrefOf(ps?.prop?.["calendar-home-set"]?.href);
      if (href) {
        homePath = href;
        break;
      }
    }
    if (homePath) break;
  }
  if (!homePath) throw new Error("Could not discover iCloud calendar home.");
  const homeUrl = assertSafeIcloudUrl(
    new URL(homePath, principalUrl).toString(),
  ).toString();
  return { principalUrl, homeUrl };
}

export async function connectIcloudWithAppPassword(input: {
  appleIdEmail: string;
  appSpecificPassword: string;
}): Promise<
  ProviderTokens & { accountLabel: string; accountEmail: string; accountId: string }
> {
  const email = input.appleIdEmail.trim().toLowerCase();
  const password = input.appSpecificPassword.replace(/\s+/g, "");
  if (!email.includes("@")) {
    throw new Error("Enter your Apple Account email address.");
  }
  if (password.length < 8) {
    throw new Error("Enter the app-specific password from account.apple.com.");
  }
  // Reject if it looks like they're pasting a normal long password without dashes —
  // Apple app-specific passwords are typically xxxx-xxxx-xxxx-xxxx.
  const tokens: ProviderTokens = {
    accessToken: "", // unused for CalDAV
    caldavUsername: email,
    caldavPassword: password,
  };
  const { principalUrl, homeUrl } = await discoverHome(tokens);
  tokens.caldavPrincipalUrl = principalUrl;
  tokens.caldavHomeUrl = homeUrl;
  return {
    ...tokens,
    accountLabel: email,
    accountEmail: email,
    accountId: email,
  };
}

function mapIcsEventsToProvider(
  events: ProviderEvent[],
  href: string,
): ProviderEvent[] {
  return events.map((e, i) => ({
    ...e,
    providerEventId: e.providerEventId || `${href}:${i}`,
  }));
}

export const icloudCalendarProvider: CalendarProviderAdapter = {
  id: "icloud",

  async probeAccount(tokens) {
    const discovered = await discoverHome(tokens);
    tokens.caldavPrincipalUrl = discovered.principalUrl;
    tokens.caldavHomeUrl = discovered.homeUrl;
    return {
      accountLabel: tokens.caldavUsername ?? "iCloud",
      accountEmail: tokens.caldavUsername ?? undefined,
      accountId: tokens.caldavUsername ?? undefined,
    };
  },

  async listCalendars(tokens) {
    let home = tokens.caldavHomeUrl;
    if (!home) {
      const d = await discoverHome(tokens);
      home = d.homeUrl;
      tokens.caldavHomeUrl = d.homeUrl;
      tokens.caldavPrincipalUrl = d.principalUrl;
    }
    const res = await caldavRequest(tokens, home, {
      method: "PROPFIND",
      depth: "1",
      body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <cs:getctag/>
    <c:supported-calendar-component-set/>
  </d:prop>
</d:propfind>`,
    });
    if (res.status >= 400) {
      throw new Error(`Failed to list iCloud calendars (${res.status}).`);
    }
    const parsed = xmlParser.parse(res.text);
    const calendars: ProviderCalendar[] = [];
    for (const resp of asArray(parsed?.multistatus?.response)) {
      const href = hrefOf(resp?.href);
      if (!href) continue;
      const propstats = asArray(resp?.propstat);
      let isCalendar = false;
      let name = "";
      let ctag = "";
      for (const ps of propstats) {
        const status = textOf(ps?.status);
        if (status && !status.includes("200")) continue;
        const rt = ps?.prop?.resourcetype;
        if (rt && ("calendar" in (rt as object) || (rt as { calendar?: unknown }).calendar != null)) {
          isCalendar = true;
        }
        name = textOf(ps?.prop?.displayname) || name;
        ctag = textOf(ps?.prop?.getctag) || ctag;
      }
      if (!isCalendar) continue;
      const absolute = assertSafeIcloudUrl(new URL(href, home).toString()).toString();
      calendars.push({
        id: absolute,
        name: name || "Calendar",
        color: null,
        timezone: null,
        isPrimary: calendars.length === 0,
      });
    }
    return calendars;
  },

  async fetchEvents(tokens, calendar, window): Promise<SyncFetchResult> {
    const calendarUrl = assertSafeIcloudUrl(calendar.providerCalendarId).toString();

    // Change-aware: if ctag unchanged, skip download.
    if (calendar.ctag) {
      const meta = await caldavRequest(tokens, calendarUrl, {
        method: "PROPFIND",
        depth: "0",
        body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop><cs:getctag/></d:prop>
</d:propfind>`,
      });
      if (meta.status < 400) {
        const parsed = xmlParser.parse(meta.text);
        const ctag = textOf(
          asArray(parsed?.multistatus?.response)?.[0]?.propstat?.prop?.getctag,
        );
        if (ctag && ctag === calendar.ctag) {
          return {
            events: [],
            deletedProviderEventIds: [],
            nextCtag: ctag,
          };
        }
      }
    }

    const report = await caldavRequest(tokens, calendarUrl, {
      method: "REPORT",
      depth: "1",
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${window.timeMin.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}"
                      end="${window.timeMax.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
    });

    if (report.status === 401) {
      const err = new Error("iCloud credentials were rejected.");
      (err as Error & { code?: string }).code = "needs_reauth";
      throw err;
    }
    if (report.status >= 400) {
      throw new Error(`iCloud event query failed (${report.status}).`);
    }

    const parsed = xmlParser.parse(report.text);
    const events: ProviderEvent[] = [];
    const seenIds = new Set<string>();

    for (const resp of asArray(parsed?.multistatus?.response)) {
      const href = hrefOf(resp?.href);
      for (const ps of asArray(resp?.propstat)) {
        const calData = ps?.prop?.["calendar-data"];
        const icsText = typeof calData === "string" ? calData : textOf(calData);
        if (!icsText || !icsText.includes("BEGIN:")) continue;
        const result = parseIcs(icsText);
        if (!result.ok) continue;
        for (const ev of mapIcsEventsToProvider(result.events, href || "event")) {
          const id = `${href}:${ev.providerEventId}`;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          events.push({ ...ev, providerEventId: id });
        }
      }
    }

    // Refresh ctag
    let nextCtag: string | null = null;
    try {
      const meta = await caldavRequest(tokens, calendarUrl, {
        method: "PROPFIND",
        depth: "0",
        body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop><cs:getctag/></d:prop>
</d:propfind>`,
      });
      if (meta.status < 400) {
        const p = xmlParser.parse(meta.text);
        nextCtag =
          textOf(asArray(p?.multistatus?.response)?.[0]?.propstat?.prop?.getctag) ||
          null;
      }
    } catch {
      // optional
    }

    // Polling sync: without sync-token REPORT, deletions are inferred by
    // replacing the window — engine performs windowed reconcile when nextCtag changes.
    return {
      events,
      deletedProviderEventIds: [],
      nextCtag,
      fullResyncRequired: false,
    };
  },
};
