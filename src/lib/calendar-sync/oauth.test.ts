import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateOAuthState,
  generatePkcePair,
  safeRedirectPath,
} from "@/lib/calendar-sync/oauth";

describe("OAuth helpers", () => {
  it("generates opaque state and PKCE verifier/challenge", () => {
    const state = generateOAuthState();
    assert.ok(state.length >= 20);
    const { verifier, challenge } = generatePkcePair();
    assert.notEqual(verifier, challenge);
    assert.ok(verifier.length >= 32);
    assert.ok(challenge.length >= 32);
  });

  it("rejects open redirects", () => {
    assert.equal(safeRedirectPath("/calendar"), "/calendar");
    assert.equal(safeRedirectPath("//evil.com"), "/calendar");
    assert.equal(safeRedirectPath("https://evil.com"), "/calendar");
    assert.equal(safeRedirectPath(null), "/calendar");
  });
});
