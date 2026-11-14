"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { AiFeatureError, userMessageFromAiError } from "@/lib/ai/errors";
import { claimCanvasClassifyUsage } from "@/lib/ai/usage";
import { classifyCanvasMaterials } from "@/lib/canvas/classify";
import { scanCanvasArchiveBytes } from "@/lib/canvas/extract";
import { CANVAS_LIMITS } from "@/lib/canvas/limits";
import { canvasImportConfirmSchema, canvasInventoryItemSchema } from "@/lib/canvas/schemas";
import {
  assertOwnedStoragePath,
  buildMaterialObjectPath,
  buildStagingArchivePath,
  CANVAS_STAGING_BUCKET,
  COURSE_MATERIALS_BUCKET,
  fingerprintForItem,
} from "@/lib/canvas/storage";
import {
  CANVAS_TOPIC_ORDER_COLUMNS,
  topicNodesForClassification,
  type CanvasTopicRow,
} from "@/lib/canvas/topics";
import type {
  CanvasClassification,
  CanvasInventoryItem,
  CanvasReviewItem,
  CanvasScanResult,
} from "@/lib/canvas/types";
import { readZipEntryBytes } from "@/lib/canvas/zip-safe";
import { isZipMagic } from "@/lib/canvas/zip-safe";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Material } from "@/types/database";

export type CanvasScanActionResult =
  | {
      ok: true;
      stagingPath: string;
      scan: Omit<CanvasScanResult, never>;
      duplicates: Record<string, string>;
    }
  | { ok: false; error: string; code?: string };

export type CanvasStagingUploadResult =
  | {
      ok: true;
      stagingPath: string;
      maxBytes: number;
    }
  | { ok: false; error: string; code?: string };

export type CanvasClassifyResult =
  | {
      ok: true;
      classifications: CanvasClassification[];
      remaining: number;
      limit: number;
      model: string;
    }
  | { ok: false; error: string; code?: string };

export type CanvasImportItemResult = {
  localId: string;
  title: string;
  status: "imported" | "skipped" | "failed";
  reason?: string;
  materialId?: string;
};

export type CanvasImportResult =
  | {
      ok: true;
      results: CanvasImportItemResult[];
      imported: number;
      skipped: number;
      failed: number;
    }
  | { ok: false; error: string; code?: string };

async function requireAuthedClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." } as const;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." } as const;
  }
  return { supabase, user } as const;
}

async function requireOwnedSubject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  subjectId: string,
) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", subjectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new AiFeatureError("unknown", error.message);
  if (!data) throw new AiFeatureError("forbidden", "Subject not found.");
  return data as { id: string; name: string };
}

function revalidateMaterials(subjectId: string) {
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/subjects");
}

async function loadDuplicateMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  subjectId: string,
  items: CanvasInventoryItem[],
): Promise<Record<string, string>> {
  const fingerprints = items.map((item) =>
    fingerprintForItem({
      archivePath: item.archivePath,
      externalUrl: item.externalUrl,
      localId: item.localId,
    }),
  );
  if (!fingerprints.length) return {};

  const { data } = await supabase
    .from("materials")
    .select("id, source_fingerprint")
    .eq("user_id", userId)
    .eq("subject_id", subjectId)
    .in("source_fingerprint", fingerprints);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.source_fingerprint) {
      const item = items.find(
        (i) =>
          fingerprintForItem({
            archivePath: i.archivePath,
            externalUrl: i.externalUrl,
            localId: i.localId,
          }) === row.source_fingerprint,
      );
      if (item) map[item.localId] = row.id;
    }
  }
  return map;
}

async function downloadStagingBytes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  stagingPath: string,
): Promise<Uint8Array> {
  assertOwnedStoragePath(userId, stagingPath);
  const { data, error } = await supabase.storage
    .from(CANVAS_STAGING_BUCKET)
    .download(stagingPath);
  if (error || !data) {
    throw new AiFeatureError(
      "invalid_input",
      error?.message?.includes("not found") || error?.message?.includes("Object not found")
        ? "Staged archive not found. Upload the export again."
        : error?.message || "Could not download staged archive.",
    );
  }
  const buf = new Uint8Array(await data.arrayBuffer());
  if (buf.byteLength > CANVAS_LIMITS.maxArchiveBytes) {
    throw new AiFeatureError("invalid_input", "Staged archive exceeds the size limit.");
  }
  if (!isZipMagic(buf)) {
    throw new AiFeatureError("invalid_input", "Staged file is not a valid ZIP / IMSCC archive.");
  }
  return buf;
}

async function removeStaging(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  stagingPath: string,
) {
  try {
    assertOwnedStoragePath(userId, stagingPath);
    await supabase.storage.from(CANVAS_STAGING_BUCKET).remove([stagingPath]);
  } catch {
    // best-effort cleanup
  }
}

/**
 * Allocate a private staging object path for a Canvas archive.
 * The browser uploads bytes via the authenticated Supabase client; this action
 * never receives the ZIP body (avoids Next.js Server Action ~1 MB limit).
 */
export async function createCanvasStagingUpload(
  subjectId: string,
): Promise<CanvasStagingUploadResult> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "You must be signed in.", code: "unauthorized" };
    }
    await requireOwnedSubject(auth.supabase, auth.user.id, subjectId);

    return {
      ok: true,
      stagingPath: buildStagingArchivePath(auth.user.id),
      maxBytes: CANVAS_LIMITS.maxArchiveBytes,
    };
  } catch (error) {
    return {
      ok: false,
      error: userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}

/**
 * Scan an archive already uploaded to private canvas-staging.
 * Accepts only a staging object path owned by the authenticated user — never ZIP bytes.
 */
export async function scanCanvasStagingArchive(
  subjectId: string,
  stagingPath: string,
): Promise<CanvasScanActionResult> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "You must be signed in.", code: "unauthorized" };
    }
    await requireOwnedSubject(auth.supabase, auth.user.id, subjectId);

    if (typeof stagingPath !== "string" || !stagingPath) {
      return { ok: false, error: "Missing staging path.", code: "invalid_input" };
    }

    try {
      assertOwnedStoragePath(auth.user.id, stagingPath);
    } catch {
      return {
        ok: false,
        error: "Staging path is not owned by the current user.",
        code: "forbidden",
      };
    }

    if (!stagingPath.startsWith(`${auth.user.id}/staging/`)) {
      return {
        ok: false,
        error: "Invalid staging reference.",
        code: "invalid_input",
      };
    }

    const bytes = await downloadStagingBytes(auth.supabase, auth.user.id, stagingPath);
    const scanned = await scanCanvasArchiveBytes(bytes);
    const scan = {
      courseTitle: scanned.courseTitle,
      format: scanned.format,
      items: scanned.items,
      warnings: scanned.warnings,
      entryCount: scanned.entryCount,
      uncompressedBytes: scanned.uncompressedBytes,
    };

    const duplicates = await loadDuplicateMap(
      auth.supabase,
      auth.user.id,
      subjectId,
      scan.items,
    );

    return { ok: true, stagingPath, scan, duplicates };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}

export async function classifyCanvasInventory(
  subjectId: string,
  payload: {
    items: CanvasInventoryItem[];
    privacyAccepted: boolean;
    sendContentConsent?: boolean;
  },
): Promise<CanvasClassifyResult> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "You must be signed in.", code: "unauthorized" };
    }
    if (!payload.privacyAccepted) {
      return {
        ok: false,
        error:
          "Confirm that you understand Google may use free-tier submissions to improve its products before continuing.",
        code: "invalid_input",
      };
    }

    const subject = await requireOwnedSubject(auth.supabase, auth.user.id, subjectId);

    const parsedItems = payload.items
      .map((item) => canvasInventoryItemSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data);

    if (!parsedItems.length) {
      return { ok: false, error: "No materials to classify.", code: "invalid_input" };
    }

    let topicsQuery = auth.supabase
      .from("topics")
      .select("id, title, parent_id, sort_order")
      .eq("subject_id", subjectId)
      .eq("user_id", auth.user.id);

    for (const column of CANVAS_TOPIC_ORDER_COLUMNS) {
      topicsQuery = topicsQuery.order(column, { ascending: true });
    }

    const { data: topics, error: topicsError } = await topicsQuery;

    if (topicsError) {
      return { ok: false, error: topicsError.message, code: "unknown" };
    }

    const topicNodes = topicNodesForClassification((topics ?? []) as CanvasTopicRow[]);

    const usage = await claimCanvasClassifyUsage(auth.supabase, auth.user.id);

    // Metadata-first: only send short HTML/text snippets when consented.
    // Content is never read from private storage here — client may not have sent
    // file bytes; snippets would require re-reading staging (omitted unless consent).
    let contentSnippets: Record<string, string> | undefined;
    if (payload.sendContentConsent) {
      contentSnippets = {};
      // Intentionally metadata-only even with consent for this first version —
      // avoid shipping full document bodies. Filenames + modules are enough for
      // most matches; consent disclosure still gates the Gemini call.
    }

    const { classifications, model } = await classifyCanvasMaterials({
      subjectName: subject.name,
      topics: topicNodes,
      items: parsedItems.slice(0, CANVAS_LIMITS.maxClassifyBatch),
      contentSnippets,
    });

    return {
      ok: true,
      classifications,
      remaining: usage.remaining,
      limit: usage.limit,
      model,
    };
  } catch (error) {
    return {
      ok: false,
      error: userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}

export async function confirmCanvasImport(
  subjectId: string,
  raw: unknown,
): Promise<CanvasImportResult> {
  const uploadedPaths: string[] = [];
  let stagingPath: string | null = null;
  let authUserId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "You must be signed in.", code: "unauthorized" };
    }
    authUserId = auth.user.id;
    supabase = auth.supabase;
    await requireOwnedSubject(auth.supabase, auth.user.id, subjectId);

    const parsed = canvasImportConfirmSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid import payload.",
        code: "invalid_input",
      };
    }

    stagingPath = parsed.data.stagingPath;
    assertOwnedStoragePath(auth.user.id, stagingPath);

    const selected = parsed.data.items.filter(
      (i): i is CanvasReviewItem =>
        i.selected && (i.kind === "file" || i.kind === "external_link"),
    );

    if (!selected.length) {
      return { ok: false, error: "Select at least one importable material.", code: "invalid_input" };
    }

    // Revalidate topic IDs belong to this subject
    const topicIds = [
      ...new Set(selected.map((i) => i.topicId).filter((id): id is string => Boolean(id))),
    ];
    if (topicIds.length) {
      const { data: ownedTopics } = await auth.supabase
        .from("topics")
        .select("id")
        .eq("subject_id", subjectId)
        .eq("user_id", auth.user.id)
        .in("id", topicIds);
      const owned = new Set((ownedTopics ?? []).map((t) => t.id));
      for (const item of selected) {
        if (item.topicId && !owned.has(item.topicId)) {
          item.topicId = null;
        }
      }
    }

    const bytes = await downloadStagingBytes(auth.supabase, auth.user.id, stagingPath);
    const scanned = await scanCanvasArchiveBytes(bytes);
    const zip = scanned.zip;

    const results: CanvasImportItemResult[] = [];

    for (const item of selected) {
      const title = item.renamedTitle.trim().slice(0, 120) || item.title.slice(0, 120);
      const fingerprint = fingerprintForItem({
        archivePath: item.archivePath,
        externalUrl: item.externalUrl,
        localId: item.localId,
      });

      if (item.duplicateOfMaterialId) {
        results.push({
          localId: item.localId,
          title,
          status: "skipped",
          reason: "Already imported",
          materialId: item.duplicateOfMaterialId,
        });
        continue;
      }

      // Idempotency: skip if fingerprint already exists
      const { data: existing } = await auth.supabase
        .from("materials")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("subject_id", subjectId)
        .eq("source_fingerprint", fingerprint)
        .maybeSingle();

      if (existing?.id) {
        results.push({
          localId: item.localId,
          title,
          status: "skipped",
          reason: "Duplicate fingerprint",
          materialId: existing.id,
        });
        continue;
      }

      try {
        if (item.kind === "external_link") {
          if (!item.externalUrl || !/^https?:\/\//i.test(item.externalUrl)) {
            results.push({
              localId: item.localId,
              title,
              status: "failed",
              reason: "Invalid external URL",
            });
            continue;
          }
          const { data: inserted, error } = await auth.supabase
            .from("materials")
            .insert({
              user_id: auth.user.id,
              subject_id: subjectId,
              topic_id: item.topicId,
              title,
              resource_type: "link",
              url: item.externalUrl.slice(0, 2000),
              description: item.modulePath
                ? `Imported from Canvas · ${item.modulePath}`.slice(0, 1000)
                : "Imported from Canvas",
              source: "canvas",
              source_fingerprint: fingerprint,
              canvas_module_path: item.modulePath,
            })
            .select("id")
            .single();

          if (error) {
            if (error.code === "23505") {
              results.push({
                localId: item.localId,
                title,
                status: "skipped",
                reason: "Duplicate",
              });
            } else {
              results.push({
                localId: item.localId,
                title,
                status: "failed",
                reason: error.message,
              });
            }
            continue;
          }

          results.push({
            localId: item.localId,
            title,
            status: "imported",
            materialId: inserted.id,
          });
          continue;
        }

        // File from archive
        if (!item.archivePath) {
          results.push({
            localId: item.localId,
            title,
            status: "failed",
            reason: "Missing archive path",
          });
          continue;
        }

        // Ensure path still exists in re-scanned archive
        const stillPresent = scanned.items.some(
          (i) => i.localId === item.localId || i.archivePath === item.archivePath,
        );
        if (!stillPresent && !zip.file(item.archivePath)) {
          results.push({
            localId: item.localId,
            title,
            status: "failed",
            reason: "File no longer found in archive",
          });
          continue;
        }

        const fileBytes = await readZipEntryBytes(zip, item.archivePath);
        const materialId = randomUUID();
        const originalFilename =
          item.archivePath.split("/").pop()?.replace(/\+/g, " ") || "file";
        const storagePath = buildMaterialObjectPath(
          auth.user.id,
          subjectId,
          materialId,
          originalFilename,
        );

        const { error: upErr } = await auth.supabase.storage
          .from(COURSE_MATERIALS_BUCKET)
          .upload(storagePath, fileBytes, {
            contentType: item.mimeHint || "application/octet-stream",
            upsert: false,
            cacheControl: "3600",
          });

        if (upErr) {
          results.push({
            localId: item.localId,
            title,
            status: "failed",
            reason: upErr.message,
          });
          continue;
        }
        uploadedPaths.push(storagePath);

        const { data: inserted, error } = await auth.supabase
          .from("materials")
          .insert({
            id: materialId,
            user_id: auth.user.id,
            subject_id: subjectId,
            topic_id: item.topicId,
            title,
            resource_type: item.suggestedResourceType,
            url: null,
            description: item.modulePath
              ? `Imported from Canvas · ${item.modulePath}`.slice(0, 1000)
              : "Imported from Canvas",
            storage_path: storagePath,
            storage_bucket: COURSE_MATERIALS_BUCKET,
            original_filename: originalFilename.slice(0, 260),
            mime_type: item.mimeHint,
            byte_size: fileBytes.byteLength,
            source: "canvas",
            source_fingerprint: fingerprint,
            canvas_module_path: item.modulePath,
          })
          .select("id")
          .single();

        if (error) {
          await auth.supabase.storage
            .from(COURSE_MATERIALS_BUCKET)
            .remove([storagePath]);
          uploadedPaths.pop();
          if (error.code === "23505") {
            results.push({
              localId: item.localId,
              title,
              status: "skipped",
              reason: "Duplicate",
            });
          } else {
            results.push({
              localId: item.localId,
              title,
              status: "failed",
              reason: error.message,
            });
          }
          continue;
        }

        results.push({
          localId: item.localId,
          title,
          status: "imported",
          materialId: inserted.id,
        });
      } catch (itemError) {
        results.push({
          localId: item.localId,
          title,
          status: "failed",
          reason:
            itemError instanceof Error ? itemError.message : "Unexpected import error",
        });
      }
    }

    await removeStaging(auth.supabase, auth.user.id, stagingPath);
    revalidateMaterials(subjectId);

    const imported = results.filter((r) => r.status === "imported").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return { ok: true, results, imported, skipped, failed };
  } catch (error) {
    // Cleanup uploaded objects on hard failure after partial uploads
    if (supabase && authUserId && uploadedPaths.length) {
      await supabase.storage.from(COURSE_MATERIALS_BUCKET).remove(uploadedPaths);
    }
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}

export async function discardCanvasStaging(stagingPath: string): Promise<{ ok: boolean }> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { ok: false };
  await removeStaging(auth.supabase, auth.user.id, stagingPath);
  return { ok: true };
}

export async function getMaterialSignedUrl(
  subjectId: string,
  materialId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { ok: false, error: auth.error ?? "You must be signed in." };

  const { data, error } = await auth.supabase
    .from("materials")
    .select("id, url, storage_path, storage_bucket, user_id, subject_id")
    .eq("id", materialId)
    .eq("user_id", auth.user.id)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Material not found." };

  const material = data as Pick<
    Material,
    "url" | "storage_path" | "storage_bucket"
  >;

  if (material.url) {
    return { ok: true, url: material.url };
  }

  if (!material.storage_path || !material.storage_bucket) {
    return { ok: false, error: "This material has no file or link." };
  }

  try {
    assertOwnedStoragePath(auth.user.id, material.storage_path);
  } catch {
    return { ok: false, error: "Invalid storage path." };
  }

  const { data: signed, error: signError } = await auth.supabase.storage
    .from(material.storage_bucket)
    .createSignedUrl(material.storage_path, CANVAS_LIMITS.signedUrlSeconds);

  if (signError || !signed?.signedUrl) {
    return { ok: false, error: signError?.message || "Could not create download link." };
  }

  return { ok: true, url: signed.signedUrl };
}
