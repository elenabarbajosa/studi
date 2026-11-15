import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { authorizeCalendarCronRequest } from "@/lib/calendar-sync/cron-auth";
import {
  assertOAuthStateExpiry,
  safeRedirectPath,
} from "@/lib/calendar-sync/oauth";
import {
  assertSameOwner,
  assertSecretMatchesConnection,
} from "@/lib/calendar-sync/ownership";

describe("cross-user link ownership", () => {
  it("rejects linking another user's assessment or task", () => {
    const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    assert.equal(
      assertSameOwner({
        eventOwnerId: userA,
        actorUserId: userA,
        assessmentOwnerId: userB,
      }).ok,
      false,
    );
    assert.equal(
      assertSameOwner({
        eventOwnerId: userA,
        actorUserId: userA,
        taskOwnerId: userB,
      }).ok,
      false,
    );
  });

  it("allows same-owner links", () => {
    const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    assert.equal(
      assertSameOwner({
        eventOwnerId: userA,
        actorUserId: userA,
        assessmentOwnerId: userA,
      }).ok,
      true,
    );
  });
});

describe("secret ownership alignment", () => {
  it("rejects mismatched secret/connection owners", () => {
    assert.equal(
      assertSecretMatchesConnection({
        secretUserId: "a",
        connectionUserId: "b",
      }),
      false,
    );
    assert.equal(
      assertSecretMatchesConnection({
        secretUserId: "a",
        connectionUserId: "a",
      }),
      true,
    );
  });
});

describe("assertOAuthStateExpiry", () => {
  it("rejects past and overlong expiry", () => {
    const now = Date.parse("2026-11-15T12:00:00.000Z");
    assert.throws(() =>
      assertOAuthStateExpiry(new Date(now - 1000).toISOString(), now),
    );
    assert.throws(() =>
      assertOAuthStateExpiry(new Date(now + 20 * 60_000).toISOString(), now),
    );
  });

  it("accepts short future expiry", () => {
    const now = Date.parse("2026-11-15T12:00:00.000Z");
    assert.doesNotThrow(() =>
      assertOAuthStateExpiry(new Date(now + 10 * 60_000).toISOString(), now),
    );
  });
});

describe("OAuth redirect hardening", () => {
  it("rejects open redirects before storage", () => {
    assert.equal(safeRedirectPath("//evil.example"), "/calendar");
    assert.equal(safeRedirectPath("https://evil.example"), "/calendar");
    assert.equal(
      safeRedirectPath("/calendar?tab=external"),
      "/calendar?tab=external",
    );
  });
});

describe("secret redaction and safe errors", () => {
  it("redacts app-specific passwords, tokens, and ciphertext keys", async () => {
    const { redactForLog } = await import("@/lib/calendar-sync/safe-errors");
    const redacted = redactForLog({
      appleIdEmail: "student@icloud.com",
      appSpecificPassword: "abcd-efgh-ijkl-mnop",
      accessToken: "ya29.secret-token-value-here",
      refreshToken: "1//refresh-token-value",
      ciphertext: "base64blob",
      connectionId: "conn-1",
      nested: { caldavPassword: "abcd-efgh-ijkl-mnop", host: "caldav.icloud.com" },
    }) as Record<string, unknown>;
    assert.equal(redacted.appleIdEmail, "student@icloud.com");
    assert.equal(redacted.appSpecificPassword, "[redacted]");
    assert.equal(redacted.accessToken, "[redacted]");
    assert.equal(redacted.refreshToken, "[redacted]");
    assert.equal(redacted.ciphertext, "[redacted]");
    assert.equal(redacted.connectionId, "conn-1");
    assert.equal(
      (redacted.nested as Record<string, unknown>).caldavPassword,
      "[redacted]",
    );
    assert.equal(
      (redacted.nested as Record<string, unknown>).host,
      "caldav.icloud.com",
    );
  });

  it("maps credential store failures to diagnostic codes only", async () => {
    const {
      safeCredentialStoreError,
      safePublicError,
      safeOAuthExchangeError,
    } = await import("@/lib/calendar-sync/safe-errors");
    assert.equal(
      safeCredentialStoreError({
        code: "42501",
        message: "permission denied for table external_calendar_secrets",
      }),
      "Could not store calendar credentials securely (42501: permission denied).",
    );
    assert.match(
      safeCredentialStoreError({
        code: "PGRST301",
        message: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload",
      }),
      /^Could not store calendar credentials securely \(PGRST301\)\.$/,
    );
    assert.equal(
      safePublicError(
        new Error("Bearer ya29.leaked-token-value-abcdefghijklmnop"),
        "iCloud connection failed.",
      ),
      "iCloud connection failed.",
    );
    assert.equal(
      safeOAuthExchangeError(
        "Google",
        "invalid_grant",
        "Token has been expired or revoked.",
      ),
      "Google authorization was denied or expired. Try connecting again.",
    );
  });
});

describe("authorizeCalendarCronRequest", () => {
  it("rejects missing or wrong secrets", () => {
    const req = {
      headers: {
        get(name: string) {
          if (name === "authorization") return "Bearer wrong";
          return null;
        },
      },
    };
    assert.equal(authorizeCalendarCronRequest(req, null), false);
    assert.equal(authorizeCalendarCronRequest(req, "expected"), false);
  });

  it("accepts Bearer and x-cron-secret matches", () => {
    assert.equal(
      authorizeCalendarCronRequest(
        {
          headers: {
            get(name: string) {
              return name === "authorization" ? "Bearer secret-value" : null;
            },
          },
        },
        "secret-value",
      ),
      true,
    );
    assert.equal(
      authorizeCalendarCronRequest(
        {
          headers: {
            get(name: string) {
              return name === "x-cron-secret" ? "secret-value" : null;
            },
          },
        },
        "secret-value",
      ),
      true,
    );
  });
});
