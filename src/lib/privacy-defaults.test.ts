import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canViewerSeeAvatar } from "@/lib/avatar-access";
import {
  LEGACY_MISSING_GAMIFICATION_LEADERBOARD_OPT_IN,
  NEW_ACCOUNT_PRIVACY_DEFAULTS,
  NEW_ACCOUNT_PRIVACY_ONBOARDING_SUMMARY,
  applyNewAccountDefaultsMigration,
  newAccountGamificationDefaults,
  newAccountProfilePrivacyFields,
} from "@/lib/privacy-defaults";
import { DEFAULT_GAMIFICATION_PREFS } from "@/lib/progress/types";

describe("new account privacy defaults", () => {
  it("matches the product table for new registrations", () => {
    assert.equal(NEW_ACCOUNT_PRIVACY_DEFAULTS.avatar_visibility, "public");
    assert.equal(NEW_ACCOUNT_PRIVACY_DEFAULTS.online_status_visibility, "friends");
    assert.equal(NEW_ACCOUNT_PRIVACY_DEFAULTS.study_status_visibility, "friends");
    assert.equal(NEW_ACCOUNT_PRIVACY_DEFAULTS.stats_visibility, "friends");
    assert.equal(NEW_ACCOUNT_PRIVACY_DEFAULTS.discoverable, true);
    assert.equal(NEW_ACCOUNT_PRIVACY_DEFAULTS.leaderboard_opt_in, true);
  });

  it("exposes profile + gamification insert payloads with those defaults", () => {
    assert.deepEqual(newAccountProfilePrivacyFields(), {
      avatar_visibility: "public",
      online_status_visibility: "friends",
      study_status_visibility: "friends",
      stats_visibility: "friends",
      discoverable: true,
    });
    assert.deepEqual(newAccountGamificationDefaults(), {
      enabled: true,
      leaderboard_opt_in: true,
      achievement_notifications: true,
      accept_challenge_invites: true,
    });
  });

  it("documents onboarding summary for each default choice", () => {
    assert.ok(NEW_ACCOUNT_PRIVACY_ONBOARDING_SUMMARY.length >= 4);
    assert.ok(
      NEW_ACCOUNT_PRIVACY_ONBOARDING_SUMMARY.some((row) => row.label === "Avatar"),
    );
  });
});

describe("existing account privacy preservation", () => {
  it("does not rewrite an existing private / opted-out profile when defaults change", () => {
    const existing = {
      avatar_visibility: "private" as const,
      online_status_visibility: "private" as const,
      study_status_visibility: "private" as const,
      stats_visibility: "private" as const,
      discoverable: false,
      leaderboard_opt_in: false,
    };
    const after = applyNewAccountDefaultsMigration(existing);
    assert.deepEqual(after, existing);
  });

  it("does not rewrite an existing friends-only avatar when defaults become public", () => {
    const existing = {
      avatar_visibility: "friends" as const,
      online_status_visibility: "friends" as const,
      study_status_visibility: "friends" as const,
      stats_visibility: "public" as const,
      discoverable: true,
      leaderboard_opt_in: false,
    };
    assert.deepEqual(applyNewAccountDefaultsMigration(existing), existing);
  });

  it("applies new defaults only when there is no prior row", () => {
    const created = applyNewAccountDefaultsMigration(null);
    assert.equal(created.avatar_visibility, "public");
    assert.equal(created.leaderboard_opt_in, true);
    assert.equal(created.discoverable, true);
  });

  it("keeps missing-row gamification fallback opted out for legacy users", () => {
    assert.equal(
      DEFAULT_GAMIFICATION_PREFS.leaderboard_opt_in,
      LEGACY_MISSING_GAMIFICATION_LEADERBOARD_OPT_IN,
    );
    assert.equal(DEFAULT_GAMIFICATION_PREFS.leaderboard_opt_in, false);
    assert.notEqual(
      DEFAULT_GAMIFICATION_PREFS.leaderboard_opt_in,
      NEW_ACCOUNT_PRIVACY_DEFAULTS.leaderboard_opt_in,
    );
  });
});

describe("friends visibility authorization for new defaults", () => {
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const viewer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("public avatar is visible without friendship", () => {
    assert.equal(
      canViewerSeeAvatar({
        viewerId: viewer,
        ownerId: owner,
        visibility: NEW_ACCOUNT_PRIVACY_DEFAULTS.avatar_visibility,
        areFriends: false,
        isBlocked: false,
      }),
      true,
    );
  });

  it("friends-level avatar still requires an accepted friendship", () => {
    assert.equal(
      canViewerSeeAvatar({
        viewerId: viewer,
        ownerId: owner,
        visibility: "friends",
        areFriends: false,
        isBlocked: false,
      }),
      false,
    );
    assert.equal(
      canViewerSeeAvatar({
        viewerId: viewer,
        ownerId: owner,
        visibility: "friends",
        areFriends: true,
        isBlocked: false,
      }),
      true,
    );
  });
});
