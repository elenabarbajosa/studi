import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canViewerSeeAvatar,
  isAvatarStoragePath,
  ownerIdFromAvatarPath,
  resolveVisibleAvatarSrc,
} from "@/lib/avatar-access";

const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const customPath = `${userA}/11111111-1111-4111-8111-111111111111.jpg`;
const googleUrl = "https://lh3.googleusercontent.com/a/example";

describe("canViewerSeeAvatar — public visibility", () => {
  it("lets two independent authenticated users see each other's public photos", () => {
    assert.equal(
      canViewerSeeAvatar({
        viewerId: userB,
        ownerId: userA,
        visibility: "public",
        areFriends: false,
        isBlocked: false,
      }),
      true,
    );
    assert.equal(
      canViewerSeeAvatar({
        viewerId: userA,
        ownerId: userB,
        visibility: "public",
        areFriends: false,
        isBlocked: false,
      }),
      true,
    );
  });

  it("still shows public photos in search/friends contexts without friendship", () => {
    assert.equal(
      canViewerSeeAvatar({
        viewerId: userB,
        ownerId: userA,
        visibility: "public",
        areFriends: false,
        isBlocked: false,
      }),
      true,
    );
  });
});

describe("canViewerSeeAvatar — friends-only", () => {
  it("allows friends and denies non-friends", () => {
    assert.equal(
      canViewerSeeAvatar({
        viewerId: userB,
        ownerId: userA,
        visibility: "friends",
        areFriends: true,
        isBlocked: false,
      }),
      true,
    );
    assert.equal(
      canViewerSeeAvatar({
        viewerId: userB,
        ownerId: userA,
        visibility: "friends",
        areFriends: false,
        isBlocked: false,
      }),
      false,
    );
  });
});

describe("canViewerSeeAvatar — private + owner", () => {
  it("denies other users and allows the owner", () => {
    assert.equal(
      canViewerSeeAvatar({
        viewerId: userB,
        ownerId: userA,
        visibility: "private",
        areFriends: true,
        isBlocked: false,
      }),
      false,
    );
    assert.equal(
      canViewerSeeAvatar({
        viewerId: userA,
        ownerId: userA,
        visibility: "private",
        areFriends: false,
        isBlocked: false,
      }),
      true,
    );
  });

  it("denies blocked viewers even when public", () => {
    assert.equal(
      canViewerSeeAvatar({
        viewerId: userB,
        ownerId: userA,
        visibility: "public",
        areFriends: false,
        isBlocked: true,
      }),
      false,
    );
  });

  it("denies unauthenticated viewers", () => {
    assert.equal(
      canViewerSeeAvatar({
        viewerId: null,
        ownerId: userA,
        visibility: "public",
        areFriends: false,
        isBlocked: false,
      }),
      false,
    );
  });
});

describe("resolveVisibleAvatarSrc — google, custom, removal, expiry", () => {
  it("returns Google URL when preference is google and view is allowed", () => {
    assert.equal(
      resolveVisibleAvatarSrc({
        canView: true,
        preference: "google",
        googleAvatarUrl: googleUrl,
        signedCustomUrl: null,
      }),
      googleUrl,
    );
  });

  it("returns signed custom URL when preference is custom and view is allowed", () => {
    const signed =
      "https://project.supabase.co/storage/v1/object/sign/avatars/a/b.jpg?token=abc";
    assert.equal(
      resolveVisibleAvatarSrc({
        canView: true,
        preference: "custom",
        googleAvatarUrl: googleUrl,
        signedCustomUrl: signed,
      }),
      signed,
    );
  });

  it("falls back to initials when view is denied (private)", () => {
    assert.equal(
      resolveVisibleAvatarSrc({
        canView: false,
        preference: "custom",
        googleAvatarUrl: null,
        signedCustomUrl: "https://example.com/secret.jpg",
      }),
      null,
    );
  });

  it("falls back to initials after avatar removal (no remote source)", () => {
    assert.equal(
      resolveVisibleAvatarSrc({
        canView: true,
        preference: "initials",
        googleAvatarUrl: null,
        signedCustomUrl: null,
      }),
      null,
    );
    assert.equal(
      resolveVisibleAvatarSrc({
        canView: true,
        preference: "custom",
        googleAvatarUrl: null,
        signedCustomUrl: null,
      }),
      null,
    );
  });

  it("falls back to initials when signed URL mint failed / expired path unusable", () => {
    assert.equal(
      resolveVisibleAvatarSrc({
        canView: true,
        preference: "custom",
        googleAvatarUrl: null,
        signedCustomUrl: "   ",
      }),
      null,
    );
  });
});

describe("avatar storage path validation", () => {
  it("accepts owner-scoped object paths and rejects traversal / other buckets", () => {
    assert.equal(isAvatarStoragePath(customPath), true);
    assert.equal(ownerIdFromAvatarPath(customPath), userA);
    assert.equal(isAvatarStoragePath(null), false);
    assert.equal(isAvatarStoragePath(""), false);
    assert.equal(isAvatarStoragePath("../secrets/file.jpg"), false);
    assert.equal(isAvatarStoragePath("course-materials/x/y.pdf"), false);
    assert.equal(
      isAvatarStoragePath(`${userA}/nested/extra.jpg`),
      false,
    );
    assert.equal(ownerIdFromAvatarPath("not-a-uuid/file.jpg"), null);
  });
});
