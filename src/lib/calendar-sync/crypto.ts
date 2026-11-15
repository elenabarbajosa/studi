import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { isCalendarSecretsKeyConfigured } from "@/lib/calendar-sync/config";
import type { EncryptedSecretBlob, ProviderTokens } from "@/lib/calendar-sync/types";

export { isCalendarSecretsKeyConfigured };

const KEY_VERSION = 1;
const ALGO = "aes-256-gcm";

function decodeKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const buf = Buffer.from(trimmed, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "STUDI_CALENDAR_SECRETS_KEY must be 32 bytes (64 hex chars or base64).",
    );
  }
  return buf;
}

function requireKey(): Buffer {
  const raw = process.env.STUDI_CALENDAR_SECRETS_KEY;
  if (!raw?.trim() || !isCalendarSecretsKeyConfigured()) {
    throw new Error(
      "Server encryption is not configured (STUDI_CALENDAR_SECRETS_KEY).",
    );
  }
  return decodeKey(raw);
}

export function encryptProviderTokens(tokens: ProviderTokens): EncryptedSecretBlob {
  const key = requireKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(tokens), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

export function decryptProviderTokens(blob: EncryptedSecretBlob): ProviderTokens {
  const key = requireKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as ProviderTokens;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid decrypted calendar secret payload.");
  }
  return parsed;
}

export { redactForLog } from "@/lib/calendar-sync/safe-errors";
