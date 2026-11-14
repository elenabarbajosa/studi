import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  AI_LIMITS,
  getOwnerUserId,
  isOwnerUserId,
  resolveAiDailyLimit,
} from "@/lib/ai/limits";

const OWNER =
  "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER =
  "11111111-2222-4333-8444-555555555555";

afterEach(() => {
  delete process.env.STUDI_OWNER_USER_ID;
});

describe("getOwnerUserId / isOwnerUserId", () => {
  it("returns null when unset or malformed", () => {
    assert.equal(getOwnerUserId(), null);
    process.env.STUDI_OWNER_USER_ID = "not-a-uuid";
    assert.equal(getOwnerUserId(), null);
    process.env.STUDI_OWNER_USER_ID = "elenabarbajosa@gmail.com";
    assert.equal(getOwnerUserId(), null);
  });

  it("matches only the configured auth UUID (case-insensitive)", () => {
    process.env.STUDI_OWNER_USER_ID = OWNER.toUpperCase();
    assert.equal(getOwnerUserId(), OWNER);
    assert.equal(isOwnerUserId(OWNER), true);
    assert.equal(isOwnerUserId(OWNER.toUpperCase()), true);
    assert.equal(isOwnerUserId(OTHER), false);
    assert.equal(isOwnerUserId(undefined), false);
    assert.equal(isOwnerUserId("elenabarbajosa@gmail.com"), false);
  });
});

describe("resolveAiDailyLimit", () => {
  it("gives owner 100/day and everyone else 3/day", () => {
    process.env.STUDI_OWNER_USER_ID = OWNER;
    assert.equal(resolveAiDailyLimit(OWNER), AI_LIMITS.ownerDailyPerFeature);
    assert.equal(resolveAiDailyLimit(OWNER), 100);
    assert.equal(resolveAiDailyLimit(OTHER), AI_LIMITS.dailyPerFeature);
    assert.equal(resolveAiDailyLimit(OTHER), 3);
  });

  it("cannot be spoofed via email-like strings or missing env", () => {
    delete process.env.STUDI_OWNER_USER_ID;
    assert.equal(resolveAiDailyLimit(OWNER), 3);
    process.env.STUDI_OWNER_USER_ID = OWNER;
    assert.equal(resolveAiDailyLimit("elenabarbajosa@gmail.com"), 3);
  });
});
