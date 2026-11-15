/**
 * Pure helpers for idempotent external calendar connection reuse.
 * No I/O — safe to unit test without Supabase.
 */

export type ConnectionLookupRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string | null;
  status: string;
};

export type ConnectionReuseDecision =
  | { action: "insert" }
  | { action: "reuse"; connection: ConnectionLookupRow }
  | { action: "forbidden" };

/**
 * Decide insert vs reuse for (user, provider, provider_account_id).
 * Foreign rows (other users) must never be updated — even if present in the
 * candidate list (defense in depth beyond RLS).
 */
export function resolveOwnedConnectionReuse(input: {
  actorUserId: string;
  provider: string;
  providerAccountId: string;
  candidates: ConnectionLookupRow[];
}): ConnectionReuseDecision {
  const accountId = input.providerAccountId.trim();
  if (!input.actorUserId || !input.provider || !accountId) {
    return { action: "forbidden" };
  }

  const matching = input.candidates.filter(
    (row) =>
      row.provider === input.provider &&
      (row.provider_account_id ?? "").trim() === accountId,
  );

  const foreign = matching.find((row) => row.user_id !== input.actorUserId);
  if (foreign && matching.every((row) => row.user_id !== input.actorUserId)) {
    // Only foreign matches — never reuse another user's connection.
    return { action: "forbidden" };
  }

  const owned = matching.filter((row) => row.user_id === input.actorUserId);
  if (owned.length === 0) return { action: "insert" };

  // Unique constraint guarantees at most one; pick the first deterministically.
  return { action: "reuse", connection: owned[0]! };
}

/** PostgREST / Postgres unique violation (including concurrent insert races). */
export function isUniqueConstraintError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = error.message ?? "";
  return (
    /duplicate key/i.test(msg) ||
    /unique constraint/i.test(msg) ||
    /provider_account_unique/i.test(msg)
  );
}

/** User-facing message when a unique conflict cannot be recovered. */
export function connectionConflictMessage(providerLabel: string): string {
  return `This ${providerLabel} account is already linked. Try again in a moment, or disconnect it first from Calendar settings.`;
}
