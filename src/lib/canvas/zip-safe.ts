import JSZip from "jszip";

import { CANVAS_LIMITS } from "@/lib/canvas/limits";

export type SafeZipEntry = {
  path: string;
  size: number;
  compressedSize: number;
  isDirectory: boolean;
};

export type SafeZipReadResult = {
  entries: SafeZipEntry[];
  zip: JSZip;
};

const ZIP_MAGIC = [0x50, 0x4b]; // PK

export function isZipMagic(bytes: Uint8Array | ArrayBuffer) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return u8.length >= 4 && u8[0] === ZIP_MAGIC[0] && u8[1] === ZIP_MAGIC[1];
}

/** Normalize and validate an archive entry path. Returns null if unsafe. */
export function sanitizeZipPath(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const normalized = raw.replace(/\\/g, "/");
  if (!normalized || normalized.includes("\0")) return null;
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return null;
  const parts = normalized.split("/").filter((p) => p !== "" && p !== ".");
  if (!parts.length) return null;
  // ZIP Slip: any parent segment is unsafe
  if (parts.some((p) => p === "..")) return null;
  // Reject Windows device names and trailing dots/spaces
  if (parts.some((p) => /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(p))) return null;
  const path = parts.join("/");
  if (path.length > 500) return null;
  return path;
}

/**
 * Load a ZIP with bomb / traversal protections.
 * Does not extract file bytes yet — callers read selected entries via `zip.file`.
 */
export async function openSafeZip(
  data: ArrayBuffer | Uint8Array,
  limits: {
    maxUncompressedBytes?: number;
    maxEntryBytes?: number;
    maxEntryCount?: number;
    maxCompressionRatio?: number;
  } = {},
): Promise<SafeZipReadResult> {
  const maxUncompressed = limits.maxUncompressedBytes ?? CANVAS_LIMITS.maxUncompressedBytes;
  const maxEntry = limits.maxEntryBytes ?? CANVAS_LIMITS.maxEntryBytes;
  const maxCount = limits.maxEntryCount ?? CANVAS_LIMITS.maxEntryCount;
  const maxRatio = limits.maxCompressionRatio ?? CANVAS_LIMITS.maxCompressionRatio;

  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!isZipMagic(u8)) {
    throw new Error("Not a valid ZIP / IMSCC archive (bad magic bytes).");
  }
  if (u8.byteLength > CANVAS_LIMITS.maxArchiveBytes) {
    throw new Error(
      `Archive is too large (max ${Math.round(CANVAS_LIMITS.maxArchiveBytes / (1024 * 1024))} MB).`,
    );
  }

  const zip = await JSZip.loadAsync(u8, {
    // Avoid creating directories for absolute / unsafe names — we filter below.
    createFolders: false,
  });

  const seen = new Set<string>();
  const entries: SafeZipEntry[] = [];
  let totalUncompressed = 0;

  const files = Object.values(zip.files);
  if (files.length > maxCount) {
    throw new Error(`Archive has too many entries (max ${maxCount}).`);
  }

  for (const file of files) {
    const path = sanitizeZipPath(file.name);
    if (!path) {
      if (file.dir) continue;
      throw new Error(`Unsafe archive path rejected: ${file.name.slice(0, 80)}`);
    }
    if (seen.has(path.toLowerCase())) {
      throw new Error(`Duplicate archive entry: ${path}`);
    }
    seen.add(path.toLowerCase());

    // JSZip: _data may expose uncompressedSize / compressedSize after load
    const dataNode = (file as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } })
      ._data;
    const size = Number(dataNode?.uncompressedSize ?? 0);
    const compressedSize = Number(dataNode?.compressedSize ?? 0);

    if (!file.dir) {
      if (size > maxEntry) {
        throw new Error(`File too large inside archive: ${path}`);
      }
      totalUncompressed += size;
      if (totalUncompressed > maxUncompressed) {
        throw new Error("Archive expands beyond the safe size limit.");
      }
      if (compressedSize > 0 && size / compressedSize > maxRatio) {
        throw new Error(`Suspicious compression ratio for ${path}`);
      }
    }

    entries.push({
      path,
      size,
      compressedSize,
      isDirectory: Boolean(file.dir),
    });
  }

  return { entries, zip };
}

export async function readZipEntryBytes(
  zip: JSZip,
  path: string,
  maxBytes = CANVAS_LIMITS.maxEntryBytes,
): Promise<Uint8Array> {
  const safe = sanitizeZipPath(path);
  if (!safe) throw new Error("Unsafe path");
  const file = zip.file(safe);
  if (!file || file.dir) throw new Error(`Missing file: ${safe}`);
  const buf = await file.async("uint8array");
  if (buf.byteLength > maxBytes) {
    throw new Error(`Extracted file exceeds size limit: ${safe}`);
  }
  return buf;
}

export async function readZipEntryText(
  zip: JSZip,
  path: string,
  maxChars = 200_000,
): Promise<string> {
  const bytes = await readZipEntryBytes(zip, path);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}
