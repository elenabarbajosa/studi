import { createHash, randomBytes } from "node:crypto";

export function generateOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function oauthStateExpiresAt(minutes = 10): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function safeRedirectPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/calendar";
  }
  return path;
}

const MAX_STATE_TTL_MS = 15 * 60_000;

export function assertOAuthStateExpiry(
  expiresAtIso: string,
  now = Date.now(),
): void {
  const expiresAt = new Date(expiresAtIso).getTime();
  if (Number.isNaN(expiresAt) || expiresAt <= now) {
    throw new Error("OAuth state expiry must be in the future.");
  }
  if (expiresAt > now + MAX_STATE_TTL_MS) {
    throw new Error("OAuth state expiry exceeds 15 minutes.");
  }
}
