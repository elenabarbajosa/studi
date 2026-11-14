import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CANVAS_LIMITS } from "@/lib/canvas/limits";

describe("CANVAS_LIMITS upload routing", () => {
  it("keeps any residual direct FormData path under Next.js 1 MB Server Action default", () => {
    assert.ok(CANVAS_LIMITS.maxDirectUploadBytes < 1024 * 1024);
    assert.ok(CANVAS_LIMITS.maxDirectUploadBytes <= 900 * 1024);
  });

  it("allows staging archives up to 25 MB", () => {
    assert.equal(CANVAS_LIMITS.maxArchiveBytes, 25 * 1024 * 1024);
    assert.ok(CANVAS_LIMITS.maxArchiveBytes > CANVAS_LIMITS.maxDirectUploadBytes);
  });
});
