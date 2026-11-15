/**
 * Pure ownership checks mirrored by migration 019 triggers.
 * Used by server actions for early rejection; DB remains the authority.
 */

export function assertSameOwner(input: {
  eventOwnerId: string;
  actorUserId: string;
  assessmentOwnerId?: string | null;
  taskOwnerId?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (input.actorUserId !== input.eventOwnerId) {
    return { ok: false, error: "Not allowed" };
  }
  if (
    input.assessmentOwnerId != null &&
    input.assessmentOwnerId !== input.eventOwnerId
  ) {
    return { ok: false, error: "Not allowed" };
  }
  if (input.taskOwnerId != null && input.taskOwnerId !== input.eventOwnerId) {
    return { ok: false, error: "Not allowed" };
  }
  return { ok: true };
}

export function assertSecretMatchesConnection(input: {
  secretUserId: string;
  connectionUserId: string;
}): boolean {
  return input.secretUserId === input.connectionUserId;
}
