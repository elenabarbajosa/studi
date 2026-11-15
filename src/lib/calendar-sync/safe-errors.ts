/**
 * Safe error surfaces and log redaction for calendar integrations.
 * Never include tokens, passwords, ciphertext, or encryption keys.
 */

const SENSITIVE_VALUE_RE =
  /Bearer\s+\S+|eyJ[A-Za-z0-9_-]{10,}|access_token|refresh_token|client_secret|app.?specific|caldavPassword|ciphertext|STUDI_CALENDAR_SECRETS_KEY|SUPABASE_SERVICE_ROLE_KEY|[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i;

const SENSITIVE_KEY_RE =
  /token|password|secret|authorization|verifier|ciphertext|auth_?tag|appspecific|caldavPassword|refresh_?token|access_?token|client_secret|code_verifier|SECRETS_KEY|SERVICE_ROLE/i;

/** Redact secrets from any object before logging. */
export function redactForLog(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (SENSITIVE_VALUE_RE.test(value)) return "[redacted]";
    if (value.length > 24 && /token|password|secret|Bearer/i.test(value)) {
      return "[redacted]";
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(redactForLog);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactForLog(v);
      }
    }
    return out;
  }
  return value;
}

export type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** Map a Supabase/PostgREST write failure to a client-safe credential-store message. */
export function safeCredentialStoreError(error: DbErrorLike): string {
  const code = (error.code ?? "unknown").trim() || "unknown";
  if (code === "42501") {
    return `Could not store calendar credentials securely (${code}: permission denied).`;
  }
  if (code === "23503") {
    return `Could not store calendar credentials securely (${code}: missing connection).`;
  }
  if (code === "23505") {
    return `Could not store calendar credentials securely (${code}: conflict).`;
  }
  return `Could not store calendar credentials securely (${code}).`;
}

export function safeCredentialLoadError(error: DbErrorLike): string {
  const code = (error.code ?? "unknown").trim() || "unknown";
  if (code === "42501") {
    return `Could not load calendar credentials (${code}: permission denied).`;
  }
  return `Could not load calendar credentials (${code}).`;
}

function extractMessage(err: unknown): string | null {
  if (err instanceof Error && err.message) return err.message;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  if (typeof err === "string") return err;
  return null;
}

/** Client-facing message: keep useful text, never echo secrets or DB internals. */
export function safePublicError(err: unknown, fallback: string): string {
  const raw = extractMessage(err);
  if (!raw) return fallback;
  const msg = raw.trim();
  if (!msg || SENSITIVE_VALUE_RE.test(msg)) return fallback;
  // Never surface Postgres/PostgREST constraint noise in the UI.
  if (
    /duplicate key|unique constraint|provider_account_unique|violates unique|23505/i.test(
      msg,
    )
  ) {
    return fallback;
  }
  // Provider HTTP status style messages are safe.
  if (/^iCloud |^Google |^Microsoft |^Outlook |^Enter |^Setup |^Could not |^Invalid |^Only |^CalDAV |^OAuth |^Server |^List /i.test(msg)) {
    return msg.slice(0, 400);
  }
  if (/permission denied|not configured|reconnect|rejected these credentials|admin approval/i.test(msg)) {
    return msg.slice(0, 400);
  }
  // Unknown/provider noise — prefer fallback over leaking upstream bodies.
  if (msg.length > 180) return fallback;
  return msg.slice(0, 400);
}

/** Value suitable for last_sync_error columns (no secrets). */
export function safeSyncErrorForStorage(err: unknown, fallback = "Synchronization failed."): string {
  return safePublicError(err, fallback).slice(0, 500);
}

/** DB write/read failures: expose PostgREST code only. */
export function safeDbOpError(
  operation: string,
  error: DbErrorLike,
): string {
  const code = (error.code ?? "unknown").trim() || "unknown";
  return `${operation} failed (${code}).`;
}

/** OAuth token endpoint failures: never include raw provider bodies that may echo secrets. */
export function safeOAuthExchangeError(
  provider: "Google" | "Microsoft",
  errorCode: string | null | undefined,
  description?: string | null,
): string {
  const code = (errorCode ?? "").trim();
  const desc = (description ?? "").trim();
  if (desc && SENSITIVE_VALUE_RE.test(desc)) {
    return code
      ? `${provider} token exchange failed (${code}).`
      : `${provider} token exchange failed.`;
  }
  if (
    code === "invalid_grant" &&
    desc &&
    /AADSTS65001|admin/i.test(desc)
  ) {
    return "Your school or work account requires admin approval before Outlook can connect.";
  }
  if (code === "invalid_grant") {
    return `${provider} authorization was denied or expired. Try connecting again.`;
  }
  if (code) return `${provider} token exchange failed (${code}).`;
  if (desc && desc.length <= 180 && !SENSITIVE_VALUE_RE.test(desc)) {
    return desc.slice(0, 180);
  }
  return `${provider} token exchange failed.`;
}
