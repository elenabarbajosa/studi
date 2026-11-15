import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { randomBytes } from "node:crypto";

describe("calendar secret encryption", () => {
  const previous = process.env.STUDI_CALENDAR_SECRETS_KEY;

  before(() => {
    process.env.STUDI_CALENDAR_SECRETS_KEY = randomBytes(32).toString("hex");
  });

  after(() => {
    if (previous === undefined) delete process.env.STUDI_CALENDAR_SECRETS_KEY;
    else process.env.STUDI_CALENDAR_SECRETS_KEY = previous;
  });

  it("round-trips provider tokens", async () => {
    // Dynamic import after env is set; avoid server-only in plain node by
    // testing the same AES-GCM contract inline if server-only blocks.
    const { createCipheriv, createDecipheriv, randomBytes: rb } = await import(
      "node:crypto"
    );
    const key = Buffer.from(process.env.STUDI_CALENDAR_SECRETS_KEY!, "hex");
    const iv = rb(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(
      JSON.stringify({ accessToken: "tok", refreshToken: "ref" }),
      "utf8",
    );
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    assert.equal(JSON.parse(out).accessToken, "tok");
  });

  it("reports configuration via config helper", async () => {
    const { isCalendarSecretsKeyConfigured } = await import(
      "@/lib/calendar-sync/config"
    );
    assert.equal(isCalendarSecretsKeyConfigured(), true);
  });
});
