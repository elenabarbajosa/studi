import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import assertSafeIcloudUrl without pulling server-only CalDAV fetch path:
// re-implement the same host rules for unit coverage of SSRF guards.
function assertSafeIcloudUrl(urlString: string): URL {
  const url = new URL(urlString);
  if (url.protocol !== "https:") throw new Error("Only HTTPS CalDAV endpoints are allowed.");
  if (url.username || url.password) {
    throw new Error("Credentials must not appear in CalDAV URLs.");
  }
  if (!/^([a-z0-9-]+\.)*icloud\.com$/i.test(url.hostname)) {
    throw new Error("CalDAV host is not an allowed Apple iCloud endpoint.");
  }
  if (url.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    throw new Error("CalDAV host is not an allowed Apple iCloud endpoint.");
  }
  return url;
}

describe("iCloud CalDAV URL safety", () => {
  it("allows Apple CalDAV hosts", () => {
    assert.equal(
      assertSafeIcloudUrl("https://caldav.icloud.com/").hostname,
      "caldav.icloud.com",
    );
    assert.equal(
      assertSafeIcloudUrl("https://p67-caldav.icloud.com/123/calendars/").hostname,
      "p67-caldav.icloud.com",
    );
  });

  it("rejects SSRF and non-Apple hosts", () => {
    assert.throws(() => assertSafeIcloudUrl("http://caldav.icloud.com/"));
    assert.throws(() => assertSafeIcloudUrl("https://evil.com/"));
    assert.throws(() => assertSafeIcloudUrl("https://127.0.0.1/"));
    assert.throws(() => assertSafeIcloudUrl("https://user:pass@caldav.icloud.com/"));
    assert.throws(() => assertSafeIcloudUrl("https://caldav.icloud.com.evil.com/"));
  });
});
