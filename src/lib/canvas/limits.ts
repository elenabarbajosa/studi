/** Conservative Canvas import limits (Vercel + Supabase free-tier aware). */

export const CANVAS_LIMITS = {
  /** Max archive size accepted via private storage staging. */
  maxArchiveBytes: 25 * 1024 * 1024,
  /**
   * Hard ceiling if a Server Action ever accepts FormData bytes.
   * Next.js defaults `serverActions.bodySizeLimit` to 1 MB — stay under it.
   * The UI always uses private staging upload instead; do not raise this
   * without also raising next.config serverActions.bodySizeLimit.
   */
  maxDirectUploadBytes: 900 * 1024,
  /** Total uncompressed bytes across all entries. */
  maxUncompressedBytes: 80 * 1024 * 1024,
  /** Single entry uncompressed size. */
  maxEntryBytes: 20 * 1024 * 1024,
  /** Max files inspected inside an archive. */
  maxEntryCount: 400,
  /** Reject when compressed→uncompressed ratio exceeds this (ZIP bomb). */
  maxCompressionRatio: 80,
  /** Max characters of HTML/text sent to Gemini per batch (metadata-first). */
  maxAiContextChars: 24_000,
  /** Max materials classified in one AI call. */
  maxClassifyBatch: 80,
  /** Staging object TTL hint (hours) for docs / cleanup. */
  stagingTtlHours: 24,
  /** Signed URL lifetime for opening private files. */
  signedUrlSeconds: 60 * 60,
} as const;

export const CANVAS_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".pptx",
  ".ppt",
  ".docx",
  ".doc",
  ".txt",
  ".html",
  ".htm",
  ".md",
] as const;

export const CANVAS_SKIP_NAME_RE =
  /(^|\/)(\.|__MACOSX|Thumbs\.db|desktop\.ini|preview|thumbnail|icon)/i;

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
