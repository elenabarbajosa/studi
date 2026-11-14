"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  FileArchive,
  LoaderCircle,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  classifyCanvasInventory,
  confirmCanvasImport,
  createCanvasStagingUpload,
  discardCanvasStaging,
  scanCanvasStagingArchive,
  type CanvasImportItemResult,
} from "@/actions/canvas-import";
import { FormError, NativeSelect, PrimaryActions } from "@/components/studi/form-controls";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CANVAS_LIMITS, formatBytes } from "@/lib/canvas/limits";
import { CANVAS_STAGING_BUCKET } from "@/lib/canvas/storage";
import type {
  CanvasClassification,
  CanvasInventoryItem,
  CanvasReviewItem,
  CanvasScanResult,
} from "@/lib/canvas/types";
import { createClient } from "@/lib/supabase/client";
import { RESOURCE_TYPE_META } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Topic } from "@/types/database";

type Step = "upload" | "scan" | "organize" | "review" | "import" | "done";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
  topics: Topic[];
};

function topicTree(topics: Topic[]) {
  return topics
    .filter((t) => t.parent_id === null)
    .flatMap((root) => [root, ...topics.filter((t) => t.parent_id === root.id)]);
}

function confidenceTone(c: CanvasClassification["confidence"]) {
  if (c === "high") return "text-success";
  if (c === "medium") return "text-warning";
  if (c === "low") return "text-ink-3";
  return "text-ink-3";
}

export function ImportCanvasDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
  topics,
}: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [sendContentConsent, setSendContentConsent] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [stagingPath, setStagingPath] = useState<string | null>(null);
  const [scan, setScan] = useState<CanvasScanResult | null>(null);
  const [duplicates, setDuplicates] = useState<Record<string, string>>({});
  const [reviewItems, setReviewItems] = useState<CanvasReviewItem[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [importResults, setImportResults] = useState<CanvasImportItemResult[]>([]);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "file" | "external_link" | "other">(
    "all",
  );
  const [bulkTopicId, setBulkTopicId] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const topicOptions = useMemo(() => topicTree(topics), [topics]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPrivacyAccepted(false);
    setSendContentConsent(false);
    setClientError(null);
    setStagingPath(null);
    setScan(null);
    setDuplicates({});
    setReviewItems([]);
    setRemaining(null);
    setLimit(null);
    setImportResults([]);
    setQuery("");
    setKindFilter("all");
    setBulkTopicId("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (stagingPath && step !== "done") {
        void discardCanvasStaging(stagingPath);
      }
      reset();
    }
    onOpenChange(next);
  };

  const pickFile = (f: File | null) => {
    setClientError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const name = f.name.toLowerCase();
    if (!name.endsWith(".zip") && !name.endsWith(".imscc")) {
      setClientError("Only .zip and .imscc archives are supported.");
      setFile(null);
      return;
    }
    if (f.size > CANVAS_LIMITS.maxArchiveBytes) {
      setClientError(`Archive must be ${formatBytes(CANVAS_LIMITS.maxArchiveBytes)} or smaller.`);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const buildReview = (
    items: CanvasInventoryItem[],
    classifications: CanvasClassification[],
    dupes: Record<string, string>,
  ): CanvasReviewItem[] => {
    const byId = new Map(classifications.map((c) => [c.localId, c]));
    return items.map((item) => {
      const c = byId.get(item.localId);
      const importable = item.kind === "file" || item.kind === "external_link";
      return {
        ...item,
        selected: importable && !dupes[item.localId],
        topicId: c?.topicId ?? null,
        confidence: c?.confidence ?? "none",
        explanation: c?.explanation ?? "",
        renamedTitle: item.title.slice(0, 120),
        duplicateOfMaterialId: dupes[item.localId] ?? null,
      };
    });
  };

  const runScan = () => {
    if (!file) {
      setClientError("Choose a Canvas export archive.");
      return;
    }
    if (file.size > CANVAS_LIMITS.maxArchiveBytes) {
      setClientError(
        `Archive must be ${formatBytes(CANVAS_LIMITS.maxArchiveBytes)} or smaller.`,
      );
      return;
    }
    setClientError(null);
    setStep("scan");
    startTransition(async () => {
      let uploadedPath: string | null = null;
      try {
        // Always stage via private Supabase storage — never send ZIP bytes through
        // a Server Action (Next.js default body limit is 1 MB).
        const staging = await createCanvasStagingUpload(subjectId);
        if (!staging.ok) {
          setClientError(staging.error);
          setStep("upload");
          return;
        }

        uploadedPath = staging.stagingPath;
        setStagingPath(staging.stagingPath);

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(CANVAS_STAGING_BUCKET)
          .upload(staging.stagingPath, file, {
            contentType: "application/zip",
            upsert: false,
            cacheControl: "3600",
          });

        if (uploadError) {
          setClientError(
            uploadError.message.includes("Bucket not found") ||
              uploadError.message.includes("not found")
              ? "Canvas storage is not configured. Apply migration 016_canvas_materials_storage.sql."
              : uploadError.message ||
                  "Upload failed. Try a smaller archive or check storage setup.",
          );
          void discardCanvasStaging(staging.stagingPath);
          setStagingPath(null);
          setStep("upload");
          return;
        }

        const result = await scanCanvasStagingArchive(
          subjectId,
          staging.stagingPath,
        );

        if (!result.ok) {
          setClientError(result.error);
          void discardCanvasStaging(staging.stagingPath);
          setStagingPath(null);
          setStep("upload");
          return;
        }

        setStagingPath(result.stagingPath);
        setScan(result.scan);
        setDuplicates(result.duplicates);
        setStep("organize");
      } catch (e) {
        if (uploadedPath) {
          void discardCanvasStaging(uploadedPath);
          setStagingPath(null);
        }
        setClientError(e instanceof Error ? e.message : "Scan failed.");
        setStep("upload");
      }
    });
  };

  const runClassify = () => {
    if (!scan) return;
    if (!privacyAccepted) {
      setClientError(
        "Confirm the free-tier AI disclosure before organizing with Gemini.",
      );
      return;
    }
    setClientError(null);
    setStep("scan");
    startTransition(async () => {
      const result = await classifyCanvasInventory(subjectId, {
        items: scan.items,
        privacyAccepted,
        sendContentConsent,
      });
      if (!result.ok) {
        setClientError(result.error);
        setStep("organize");
        return;
      }
      setRemaining(result.remaining);
      setLimit(result.limit);
      setReviewItems(buildReview(scan.items, result.classifications, duplicates));
      setStep("review");
    });
  };

  const skipAi = () => {
    if (!scan) return;
    setReviewItems(
      buildReview(
        scan.items,
        scan.items.map((i) => ({
          localId: i.localId,
          topicId: null,
          confidence: "none" as const,
          explanation: "Skipped AI organization",
        })),
        duplicates,
      ),
    );
    setStep("review");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviewItems.filter((item) => {
      if (kindFilter === "file" && item.kind !== "file") return false;
      if (kindFilter === "external_link" && item.kind !== "external_link") return false;
      if (
        kindFilter === "other" &&
        (item.kind === "file" || item.kind === "external_link")
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.renamedTitle.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.modulePath?.toLowerCase().includes(q) ?? false) ||
        (item.archivePath?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [reviewItems, query, kindFilter]);

  const selectedCount = reviewItems.filter((i) => i.selected).length;

  const updateItem = (localId: string, patch: Partial<CanvasReviewItem>) => {
    setReviewItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, ...patch } : i)),
    );
  };

  const bulkSelect = (selected: boolean) => {
    setReviewItems((prev) =>
      prev.map((i) => {
        if (kindFilter === "all" || filtered.some((f) => f.localId === i.localId)) {
          const importable = i.kind === "file" || i.kind === "external_link";
          return importable ? { ...i, selected } : i;
        }
        return i;
      }),
    );
  };

  const applyBulkTopic = () => {
    const topicId = bulkTopicId === "" ? null : bulkTopicId;
    setReviewItems((prev) =>
      prev.map((i) =>
        i.selected
          ? {
              ...i,
              topicId,
              confidence: topicId ? "high" : "none",
              explanation: topicId ? "Assigned in bulk" : "Unassigned",
            }
          : i,
      ),
    );
  };

  const runImport = () => {
    if (!stagingPath) {
      setClientError("Missing staged archive. Scan again.");
      return;
    }
    setClientError(null);
    setStep("import");
    startTransition(async () => {
      const result = await confirmCanvasImport(subjectId, {
        stagingPath,
        items: reviewItems,
        sendContentConsent,
      });
      if (!result.ok) {
        setClientError(result.error);
        setStep("review");
        return;
      }
      setImportResults(result.results);
      setStagingPath(null);
      setStep("done");
      const parts = [
        result.imported ? `${result.imported} imported` : null,
        result.skipped ? `${result.skipped} skipped` : null,
        result.failed ? `${result.failed} failed` : null,
      ].filter(Boolean);
      if (result.failed) {
        toast.message(`Canvas import finished: ${parts.join(", ")}`);
      } else {
        toast.success(`Canvas import: ${parts.join(", ") || "done"}`);
      }
    });
  };

  const title =
    step === "upload"
      ? "Import from Canvas"
      : step === "scan"
        ? "Scanning course"
        : step === "organize"
          ? "AI organization"
          : step === "review"
            ? "Review materials"
            : step === "import"
              ? "Importing"
              : "Import complete";

  const description =
    step === "upload"
      ? `Upload a Canvas Common Cartridge (.imscc) or ZIP export for ${subjectName}. Nothing is saved until you confirm.`
      : step === "organize"
        ? "Match materials to existing topics. Gemini only sees metadata unless you opt in."
        : step === "review"
          ? "Include, rename, and assign topics before importing."
          : undefined;

  const footer =
    step === "upload" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" disabled={!file || isPending} onClick={runScan}>
          <Upload className="size-4" aria-hidden />
          Scan course
        </Button>
      </div>
    ) : step === "organize" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" disabled={isPending} onClick={() => setStep("upload")}>
          Back
        </Button>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="ghost" disabled={isPending} onClick={skipAi}>
            Skip AI
          </Button>
          <Button type="button" disabled={!privacyAccepted || isPending} onClick={runClassify}>
            <Sparkles className="size-4" aria-hidden />
            Organize with AI
          </Button>
        </div>
      </div>
    ) : step === "review" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-ink-3">
          {selectedCount} selected
          {remaining != null && limit != null
            ? ` · ${remaining}/${limit} AI organizes left today`
            : null}
        </p>
        <div className="flex gap-2 sm:justify-end">
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => setStep("organize")}>
            Back
          </Button>
          <Button type="button" disabled={selectedCount === 0 || isPending} onClick={runImport}>
            <Check className="size-4" aria-hidden />
            Import {selectedCount}
          </Button>
        </div>
      </div>
    ) : step === "done" ? (
      <PrimaryActions>
        <Button type="button" onClick={() => handleOpenChange(false)}>
          Done
        </Button>
      </PrimaryActions>
    ) : null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={footer}
      className="md:w-[min(840px,calc(100vw-48px))] md:max-h-[min(92svh,900px)]"
    >
      {step === "upload" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-hairline bg-sunken px-4 py-10 text-center outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
              dragOver && "border-accent bg-accent-soft",
            )}
          >
            <FileArchive className="size-8 text-ink-3" aria-hidden />
            <p className="text-[14px] font-semibold text-ink">
              {file ? file.name : "Drop a .imscc or .zip export"}
            </p>
            <p className="max-w-sm text-[12.5px] text-ink-2">
              Private upload up to {formatBytes(CANVAS_LIMITS.maxArchiveBytes)}. The archive
              goes to secure staging — not through the app server body.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.imscc,application/zip"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </button>
          <FormError message={clientError ?? undefined} />
        </div>
      ) : null}

      {step === "scan" || step === "import" ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <LoaderCircle className="size-8 animate-spin text-accent-text" aria-hidden />
          <p className="text-[15px] font-medium text-ink">
            {step === "scan" ? "Reading your Canvas export…" : "Saving materials…"}
          </p>
          <p className="max-w-sm text-[13.5px] text-ink-2">
            Archives are kept in private staging only until you confirm or cancel.
          </p>
        </div>
      ) : null}

      {step === "organize" && scan ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[16px] bg-sunken px-4 py-3 text-[13.5px] text-ink-2">
            <p className="font-semibold text-ink">
              {scan.courseTitle || "Course export"} · {scan.format.toUpperCase()}
            </p>
            <p className="mt-1">
              {scan.items.length} items · {scan.entryCount} archive entries ·{" "}
              {formatBytes(scan.uncompressedBytes)} uncompressed
            </p>
            {scan.warnings.length ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12.5px] text-warning">
                {scan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <label className="flex items-start gap-3 rounded-[14px] border border-hairline px-3 py-3 text-[13px] text-ink-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--accent-ink)]"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
            />
            <span>
              I understand that on Google&apos;s free Gemini tier, prompts may be used to improve
              Google&apos;s products. Studi sends material titles, module paths, and topic names —
              not full private files unless I opt in below.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-[14px] border border-hairline px-3 py-3 text-[13px] text-ink-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--accent-ink)]"
              checked={sendContentConsent}
              onChange={(e) => setSendContentConsent(e.target.checked)}
              disabled={!privacyAccepted}
            />
            <span>
              Optional: allow short content snippets from HTML/text pages for better matching
              (still no full PDF/PPTX bodies in this version).
            </span>
          </label>

          <FormError message={clientError ?? undefined} />
        </div>
      ) : null}

      {step === "review" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files, modules…"
                className="pl-9"
              />
            </div>
            <NativeSelect
              value={kindFilter}
              onChange={(e) =>
                setKindFilter(e.target.value as typeof kindFilter)
              }
              className="sm:w-40"
            >
              <option value="all">All kinds</option>
              <option value="file">Files</option>
              <option value="external_link">External links</option>
              <option value="other">Skipped / other</option>
            </NativeSelect>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => bulkSelect(true)}>
              Select visible
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => bulkSelect(false)}>
              Clear visible
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:justify-end">
              <NativeSelect
                value={bulkTopicId}
                onChange={(e) => setBulkTopicId(e.target.value)}
                className="min-w-0 flex-1 sm:max-w-[220px]"
              >
                <option value="">Unassigned</option>
                {topicOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.parent_id ? `— ${t.title}` : t.title}
                  </option>
                ))}
              </NativeSelect>
              <Button type="button" variant="ghost" size="sm" onClick={applyBulkTopic}>
                Assign to selected
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[16px] border border-hairline">
            <div className="max-h-[min(48svh,420px)] overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-sunken text-[11.5px] tracking-[0.04em] text-ink-3 uppercase">
                  <tr>
                    <th className="w-10 px-3 py-2 font-semibold">In</th>
                    <th className="px-3 py-2 font-semibold">Material</th>
                    <th className="px-3 py-2 font-semibold">Module</th>
                    <th className="px-3 py-2 font-semibold">Topic</th>
                    <th className="w-24 px-3 py-2 font-semibold">AI</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const importable =
                      item.kind === "file" || item.kind === "external_link";
                    return (
                      <tr
                        key={item.localId}
                        className="border-t border-hairline align-top"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={!importable}
                            checked={item.selected}
                            onChange={(e) =>
                              updateItem(item.localId, { selected: e.target.checked })
                            }
                            aria-label={`Include ${item.renamedTitle}`}
                            className="size-4 accent-[var(--accent-ink)]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={item.renamedTitle}
                            onChange={(e) =>
                              updateItem(item.localId, {
                                renamedTitle: e.target.value.slice(0, 120),
                              })
                            }
                            className="h-8 text-[13px]"
                            disabled={!importable}
                          />
                          <p className="mt-1 text-[11.5px] text-ink-3">
                            {RESOURCE_TYPE_META[item.suggestedResourceType].label} · {item.kind}
                            {item.duplicateOfMaterialId ? " · duplicate" : ""}
                            {item.note ? ` · ${item.note}` : ""}
                          </p>
                        </td>
                        <td className="max-w-[160px] px-3 py-2 text-ink-2">
                          <span className="line-clamp-2">{item.modulePath || "—"}</span>
                        </td>
                        <td className="px-3 py-2">
                          <NativeSelect
                            value={item.topicId ?? ""}
                            disabled={!importable}
                            onChange={(e) =>
                              updateItem(item.localId, {
                                topicId: e.target.value || null,
                                confidence: e.target.value ? "high" : "none",
                                explanation: e.target.value
                                  ? "Manually assigned"
                                  : "Unassigned",
                              })
                            }
                            className="h-8 text-[13px]"
                          >
                            <option value="">Unassigned</option>
                            {topicOptions.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.parent_id ? `— ${t.title}` : t.title}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("font-medium capitalize", confidenceTone(item.confidence))}>
                            {item.confidence}
                          </span>
                          {item.explanation ? (
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-3">
                              {item.explanation}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13.5px] text-ink-2">
                  No materials match this filter.
                </p>
              ) : null}
            </div>
          </div>
          <FormError message={clientError ?? undefined} />
        </div>
      ) : null}

      {step === "done" ? (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-ink-2">
            Materials were added to {subjectName}. Existing materials were left unchanged.
          </p>
          <ul className="max-h-[40svh] overflow-auto rounded-[16px] border border-hairline">
            {importResults.map((r) => (
              <li
                key={r.localId}
                className="flex items-start justify-between gap-3 border-b border-hairline px-3 py-2 text-[13px] last:border-b-0"
              >
                <span className="min-w-0 truncate font-medium text-ink">{r.title}</span>
                <span
                  className={cn(
                    "shrink-0 capitalize",
                    r.status === "imported" && "text-success",
                    r.status === "skipped" && "text-ink-3",
                    r.status === "failed" && "text-danger",
                  )}
                >
                  {r.status}
                  {r.reason ? ` · ${r.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}
