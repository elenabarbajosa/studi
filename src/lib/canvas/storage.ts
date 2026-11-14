import { createHash, randomUUID } from "node:crypto";

import { CANVAS_LIMITS } from "@/lib/canvas/limits";

export const COURSE_MATERIALS_BUCKET = "course-materials" as const;
export const CANVAS_STAGING_BUCKET = "canvas-staging" as const;

export function buildStagingArchivePath(userId: string, uploadId = randomUUID()) {
  return `${userId}/staging/${uploadId}.imscc.zip`;
}

export function buildMaterialObjectPath(
  userId: string,
  subjectId: string,
  materialId: string,
  originalFilename: string,
) {
  const safe = originalFilename
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
  const ext = safe.includes(".") ? safe.slice(safe.lastIndexOf(".")) : "";
  return `${userId}/subjects/${subjectId}/${materialId}${ext || ""}`;
}

export function fingerprintForItem(input: {
  archivePath: string | null;
  externalUrl: string | null;
  localId: string;
}) {
  const seed =
    input.archivePath ??
    input.externalUrl ??
    input.localId;
  return createHash("sha256").update(`canvas:${seed}`).digest("hex").slice(0, 40);
}

export function assertOwnedStoragePath(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`)) {
    throw new Error("Storage path is not owned by the current user.");
  }
}

export { CANVAS_LIMITS };
