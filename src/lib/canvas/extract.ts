import { createHash } from "node:crypto";

import {
  CANVAS_ALLOWED_EXTENSIONS,
  CANVAS_LIMITS,
  CANVAS_SKIP_NAME_RE,
} from "@/lib/canvas/limits";
import { parseImsManifestXml } from "@/lib/canvas/imscc";
import type { CanvasInventoryItem, CanvasScanResult } from "@/lib/canvas/types";
import { openSafeZip, readZipEntryText, type SafeZipEntry } from "@/lib/canvas/zip-safe";
import type { ResourceType } from "@/lib/subjects";
import type JSZip from "jszip";

function extOf(path: string) {
  const base = path.split("/").pop() ?? path;
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i).toLowerCase() : "";
}

function basename(path: string) {
  return (path.split("/").pop() ?? path).replace(/\+/g, " ");
}

function titleFromPath(path: string) {
  return basename(path).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || basename(path);
}

function resourceTypeForExt(ext: string): ResourceType {
  if (ext === ".pdf") return "pdf";
  if (ext === ".html" || ext === ".htm" || ext === ".md" || ext === ".txt") return "article";
  if (ext === ".pptx" || ext === ".ppt" || ext === ".docx" || ext === ".doc") return "other";
  return "other";
}

function mimeForExt(ext: string): string | null {
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".html": "text/html",
    ".htm": "text/html",
    ".md": "text/markdown",
  };
  return map[ext] ?? null;
}

function localIdFor(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 24);
}

function isAllowedFile(path: string) {
  if (CANVAS_SKIP_NAME_RE.test(path)) return false;
  const ext = extOf(path);
  return (CANVAS_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

function classifyHref(href: string): {
  kind: CanvasInventoryItem["kind"];
  externalUrl: string | null;
  note: string | null;
} {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (/instructure\.com$/i.test(u.hostname) || /canvas/i.test(u.hostname)) {
        return {
          kind: "canvas_internal",
          externalUrl: trimmed,
          note: "Canvas-hosted link — requires Canvas login; not downloadable from the export.",
        };
      }
      return { kind: "external_link", externalUrl: trimmed, note: null };
    } catch {
      return { kind: "unsupported", externalUrl: null, note: "Invalid URL" };
    }
  }
  if (/^(mailto:|javascript:|data:)/i.test(trimmed)) {
    return { kind: "unsupported", externalUrl: null, note: "Unsupported URL scheme" };
  }
  return { kind: "file", externalUrl: null, note: null };
}

function folderModule(path: string): string | null {
  const parts = path.split("/");
  if (parts.length < 2) return null;
  return parts.slice(0, -1).join(" / ");
}

function pushUnique(items: CanvasInventoryItem[], item: CanvasInventoryItem) {
  if (items.some((i) => i.localId === item.localId)) return;
  items.push(item);
}

async function extractLinksFromHtml(
  zip: JSZip,
  path: string,
  modulePath: string | null,
  items: CanvasInventoryItem[],
) {
  try {
    const html = await readZipEntryText(zip, path, 100_000);
    const re = /href\s*=\s*["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const href = m[1]!;
      if (href.startsWith("#") || href.startsWith("mailto:")) continue;
      const classified = classifyHref(href);
      if (classified.kind === "external_link" || classified.kind === "canvas_internal") {
        pushUnique(items, {
          localId: localIdFor(`link:${href}`),
          kind: classified.kind,
          title: href.replace(/^https?:\/\//i, "").slice(0, 80),
          archivePath: null,
          externalUrl: classified.externalUrl,
          modulePath: modulePath ?? folderModule(path),
          suggestedResourceType: "link",
          mimeHint: null,
          sizeBytes: null,
          note: classified.note,
        });
      }
    }
  } catch {
    // ignore HTML parse failures
  }
}

async function buildFromFlatZip(
  entries: SafeZipEntry[],
  zip: JSZip,
): Promise<CanvasInventoryItem[]> {
  const items: CanvasInventoryItem[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (!isAllowedFile(entry.path)) continue;
    const ext = extOf(entry.path);
    pushUnique(items, {
      localId: localIdFor(`file:${entry.path}`),
      kind: "file",
      title: titleFromPath(entry.path).slice(0, 120),
      archivePath: entry.path,
      externalUrl: null,
      modulePath: folderModule(entry.path),
      suggestedResourceType: resourceTypeForExt(ext),
      mimeHint: mimeForExt(ext),
      sizeBytes: entry.size || null,
      note: null,
    });
    if (ext === ".html" || ext === ".htm") {
      await extractLinksFromHtml(zip, entry.path, folderModule(entry.path), items);
    }
  }
  return items;
}

async function buildFromImscc(
  entries: SafeZipEntry[],
  zip: JSZip,
  warnings: string[],
): Promise<{ items: CanvasInventoryItem[]; courseTitle: string | null }> {
  const manifestEntry = entries.find(
    (e) => !e.isDirectory && /(^|\/)imsmanifest\.xml$/i.test(e.path),
  );
  if (!manifestEntry) {
    warnings.push("No imsmanifest.xml found — treating archive as a plain ZIP of files.");
    return { items: await buildFromFlatZip(entries, zip), courseTitle: null };
  }

  const xml = await readZipEntryText(zip, manifestEntry.path, 2_000_000);
  let manifest;
  try {
    manifest = parseImsManifestXml(xml);
  } catch {
    warnings.push("imsmanifest.xml was malformed — falling back to flat file scan.");
    return { items: await buildFromFlatZip(entries, zip), courseTitle: null };
  }
  const byPath = new Map(entries.filter((e) => !e.isDirectory).map((e) => [e.path, e]));
  // Also index by basename for loose matches
  const byBase = new Map<string, SafeZipEntry>();
  for (const e of entries) {
    if (e.isDirectory) continue;
    byBase.set(basename(e.path).toLowerCase(), e);
  }

  const items: CanvasInventoryItem[] = [];

  for (const res of manifest.resources) {
    const modulePath = manifest.moduleByResourceId[res.identifier] ?? null;
    const type = res.type.toLowerCase();

    // web link resources often store URL in an XML companion file
    if (type.includes("imswl") || type.includes("weblink")) {
      for (const fileHref of res.files) {
        const entry =
          byPath.get(fileHref) ||
          byPath.get(fileHref.replace(/^\.\//, "")) ||
          byBase.get(basename(fileHref).toLowerCase());
        if (!entry) continue;
        try {
          const text = await readZipEntryText(zip, entry.path, 50_000);
          const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
          if (urlMatch) {
            const classified = classifyHref(urlMatch[0]!);
            pushUnique(items, {
              localId: localIdFor(`wl:${res.identifier}:${urlMatch[0]}`),
              kind: classified.kind,
              title: (modulePath?.split(" / ").pop() || titleFromPath(entry.path)).slice(0, 120),
              archivePath: null,
              externalUrl: classified.externalUrl,
              modulePath,
              suggestedResourceType: "link",
              mimeHint: null,
              sizeBytes: null,
              note: classified.note,
            });
          }
        } catch {
          // ignore
        }
      }
      continue;
    }

    const candidates = res.files.length ? res.files : res.href ? [res.href] : [];
    if (!candidates.length) {
      pushUnique(items, {
        localId: localIdFor(`missing:${res.identifier}`),
        kind: "missing",
        title: modulePath?.split(" / ").pop() || res.identifier,
        archivePath: null,
        externalUrl: null,
        modulePath,
        suggestedResourceType: "other",
        mimeHint: null,
        sizeBytes: null,
        note: "Manifest resource has no file reference.",
      });
      continue;
    }

    for (const href of candidates) {
      if (/^https?:\/\//i.test(href)) {
        const classified = classifyHref(href);
        pushUnique(items, {
          localId: localIdFor(`href:${href}`),
          kind: classified.kind,
          title: (modulePath?.split(" / ").pop() || href).slice(0, 120),
          archivePath: null,
          externalUrl: classified.externalUrl,
          modulePath,
          suggestedResourceType: "link",
          mimeHint: null,
          sizeBytes: null,
          note: classified.note,
        });
        continue;
      }

      const normalized = href.replace(/^\.\//, "");
      const entry =
        byPath.get(normalized) ||
        byPath.get(href) ||
        byBase.get(basename(normalized).toLowerCase());

      if (!entry) {
        pushUnique(items, {
          localId: localIdFor(`missing:${res.identifier}:${href}`),
          kind: "missing",
          title: basename(href).slice(0, 120),
          archivePath: null,
          externalUrl: null,
          modulePath,
          suggestedResourceType: "other",
          mimeHint: null,
          sizeBytes: null,
          note: "Referenced in the manifest but not present in the archive.",
        });
        continue;
      }

      if (!isAllowedFile(entry.path)) {
        pushUnique(items, {
          localId: localIdFor(`skip:${entry.path}`),
          kind: "unsupported",
          title: titleFromPath(entry.path).slice(0, 120),
          archivePath: entry.path,
          externalUrl: null,
          modulePath,
          suggestedResourceType: "other",
          mimeHint: null,
          sizeBytes: entry.size || null,
          note: "File type is not imported as study material.",
        });
        continue;
      }

      const ext = extOf(entry.path);
      pushUnique(items, {
        localId: localIdFor(`file:${entry.path}`),
        kind: "file",
        title: titleFromPath(entry.path).slice(0, 120),
        archivePath: entry.path,
        externalUrl: null,
        modulePath,
        suggestedResourceType: resourceTypeForExt(ext),
        mimeHint: mimeForExt(ext),
        sizeBytes: entry.size || null,
        note: null,
      });

      if (ext === ".html" || ext === ".htm") {
        await extractLinksFromHtml(zip, entry.path, modulePath, items);
      }
    }
  }

  // Catch orphaned allowed files not referenced by the manifest
  for (const entry of entries) {
    if (entry.isDirectory || !isAllowedFile(entry.path)) continue;
    if (items.some((i) => i.archivePath === entry.path)) continue;
    if (/imsmanifest\.xml$/i.test(entry.path)) continue;
    const ext = extOf(entry.path);
    const modulePath = folderModule(entry.path);
    pushUnique(items, {
      localId: localIdFor(`orphan:${entry.path}`),
      kind: "file",
      title: titleFromPath(entry.path).slice(0, 120),
      archivePath: entry.path,
      externalUrl: null,
      modulePath,
      suggestedResourceType: resourceTypeForExt(ext),
      mimeHint: mimeForExt(ext),
      sizeBytes: entry.size || null,
      note: "Present in archive but not linked from the manifest.",
    });
    if (ext === ".html" || ext === ".htm") {
      await extractLinksFromHtml(zip, entry.path, modulePath, items);
    }
  }

  return { items, courseTitle: manifest.title };
}

/**
 * Scan a Canvas IMSCC / ZIP archive into a material inventory.
 * Returns structured items without writing to storage.
 */
export async function scanCanvasArchiveBytes(
  data: ArrayBuffer | Uint8Array,
): Promise<CanvasScanResult & { zip: JSZip }> {
  const warnings: string[] = [];
  const { entries, zip } = await openSafeZip(data);
  const hasManifest = entries.some(
    (e) => !e.isDirectory && /(^|\/)imsmanifest\.xml$/i.test(e.path),
  );
  const format = hasManifest ? "imscc" : "zip";

  const { items, courseTitle } = hasManifest
    ? await buildFromImscc(entries, zip, warnings)
    : { items: await buildFromFlatZip(entries, zip), courseTitle: null };

  if (items.filter((i) => i.kind === "file" || i.kind === "external_link").length === 0) {
    warnings.push("No importable study materials were found in this archive.");
  }

  const uncompressedBytes = entries.reduce((s, e) => s + (e.isDirectory ? 0 : e.size), 0);

  // Cap inventory size for UI / AI
  const capped = items.slice(0, CANVAS_LIMITS.maxClassifyBatch * 2);
  if (items.length > capped.length) {
    warnings.push(
      `Showing the first ${capped.length} of ${items.length} discovered items.`,
    );
  }

  return {
    courseTitle,
    format,
    items: capped,
    warnings,
    entryCount: entries.length,
    uncompressedBytes,
    zip,
  };
}
