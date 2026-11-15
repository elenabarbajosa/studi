import "server-only";

import {
  decryptProviderTokens,
  encryptProviderTokens,
} from "@/lib/calendar-sync/crypto";
import {
  safeCredentialLoadError,
  safeCredentialStoreError,
} from "@/lib/calendar-sync/safe-errors";
import type { ProviderTokens } from "@/lib/calendar-sync/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Load and decrypt provider credentials. Service-role only — never call from
 * browser-exposed paths. Always scope by connection + expected owner.
 * Thrown messages include diagnostic codes only — never ciphertext or keys.
 */
export async function loadConnectionTokens(input: {
  connectionId: string;
  userId: string;
}): Promise<ProviderTokens> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("external_calendar_secrets")
    .select("ciphertext, iv, auth_tag, key_version, user_id")
    .eq("connection_id", input.connectionId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) throw new Error(safeCredentialLoadError(error));
  if (!data) throw new Error("Calendar credentials not found.");

  return decryptProviderTokens({
    ciphertext: data.ciphertext,
    iv: data.iv,
    authTag: data.auth_tag,
    keyVersion: data.key_version,
  });
}

export async function saveConnectionTokens(input: {
  connectionId: string;
  userId: string;
  tokens: ProviderTokens;
}): Promise<void> {
  const admin = createServiceRoleClient();
  const blob = encryptProviderTokens(input.tokens);
  const { error } = await admin.from("external_calendar_secrets").upsert(
    {
      connection_id: input.connectionId,
      user_id: input.userId,
      ciphertext: blob.ciphertext,
      iv: blob.iv,
      auth_tag: blob.authTag,
      key_version: blob.keyVersion,
    },
    { onConflict: "connection_id" },
  );
  if (error) throw new Error(safeCredentialStoreError(error));
}

export async function deleteConnectionTokens(input: {
  connectionId: string;
  userId: string;
}): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("external_calendar_secrets")
    .delete()
    .eq("connection_id", input.connectionId)
    .eq("user_id", input.userId);
  if (error) throw new Error(safeCredentialStoreError(error));
}
