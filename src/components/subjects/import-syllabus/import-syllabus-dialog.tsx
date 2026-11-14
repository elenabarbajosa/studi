"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  LoaderCircle,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { extractSyllabus, importSyllabus } from "@/actions/ai-syllabus";
import { Field, FormError } from "@/components/studi/form-controls";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Segmented } from "@/components/studi/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AI_LIMITS } from "@/lib/ai/limits";
import { countSelectedImport, reviewDraftToImportPayload } from "@/lib/ai/import-plan";
import {
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_META,
  type AssessmentType,
} from "@/lib/calendar";
import type { SyllabusReviewDraft } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

type Step = "upload" | "processing" | "review" | "confirm";
type ReviewTab = "topics" | "exams" | "suggestions";

type ImportSyllabusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
  /** Server-resolved daily AI allowance for this user. */
  dailyAiLimit: number;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function SourceBadge({
  tone,
  children,
}: {
  tone: "extracted" | "estimated" | "confirm";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "extracted" && "bg-sunken text-ink-2",
        tone === "estimated" && "bg-accent-soft text-accent-text",
        tone === "confirm" && "bg-warning-soft text-warning",
      )}
    >
      {children}
    </span>
  );
}

export function ImportSyllabusDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
  dailyAiLimit,
}: ImportSyllabusDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("topics");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SyllabusReviewDraft | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(dailyAiLimit);
  const [isPending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const reset = () => {
    setStep("upload");
    setReviewTab("topics");
    setPrivacyAccepted(false);
    setText("");
    setFile(null);
    setDragOver(false);
    setClientError(null);
    setSessionId(null);
    setDraft(null);
    setRemaining(null);
    setLimit(dailyAiLimit);
    setImporting(false);
    submittingRef.current = false;
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const pickFile = (next: File | null | undefined) => {
    setClientError(null);
    setText("");
    if (!next) {
      setFile(null);
      return;
    }
    const isPdf =
      next.type === "application/pdf" ||
      next.type === "application/x-pdf" ||
      next.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFile(null);
      setClientError("Only PDF files are supported.");
      return;
    }
    if (next.size > AI_LIMITS.maxPdfBytes) {
      setFile(null);
      setClientError(`PDF must be ${Math.floor(AI_LIMITS.maxPdfBytes / (1024 * 1024))} MB or smaller.`);
      return;
    }
    setFile(next);
  };

  const canExtract =
    privacyAccepted &&
    !isPending &&
    ((file != null && !text.trim()) || (file == null && text.trim().length > 0));

  const runExtract = () => {
    if (!canExtract) return;
    setClientError(null);
    setStep("processing");
    const formData = new FormData();
    formData.set("privacyAccepted", "true");
    if (file) formData.set("file", file);
    else formData.set("text", text);

    startTransition(async () => {
      const result = await extractSyllabus(subjectId, formData);
      if (!result.ok) {
        setStep("upload");
        setClientError(result.error);
        if (result.code === "quota_exhausted" || result.code === "rate_limited") {
          toast.error(result.error);
        }
        return;
      }
      setSessionId(result.sessionId);
      setDraft(result.draft);
      setRemaining(result.remaining);
      setLimit(result.limit);
      setStep("review");
    });
  };

  const selectedCounts = useMemo(() => {
    if (!draft || !sessionId) return { topics: 0, subtopics: 0, assessments: 0 };
    const payload = reviewDraftToImportPayload(sessionId, {
      ...draft,
      assessments: draft.assessments.map((a) => ({
        ...a,
        // treat user-cleared ambiguity as confirmed when date is set
        dateAmbiguous: a.dateAmbiguous && !a.date ? true : a.date ? false : a.dateAmbiguous,
      })),
    });
    // Count from draft selection including assessments the user confirmed
    let topics = 0;
    let subtopics = 0;
    for (const t of draft.topics) {
      if (!t.selected) continue;
      topics += 1;
      subtopics += t.subtopics.filter((s) => s.selected).length;
    }
    const assessments = draft.assessments.filter(
      (a) => a.selected && a.date && (!a.dateAmbiguous || Boolean(a.date)),
    ).length;
    void payload;
    return { topics, subtopics, assessments };
  }, [draft, sessionId]);

  const confirmImport = () => {
    if (!draft || !sessionId || submittingRef.current) return;
    submittingRef.current = true;
    setImporting(true);

    const prepared: SyllabusReviewDraft = {
      ...draft,
      assessments: draft.assessments.map((a) => ({
        ...a,
        dateAmbiguous: a.selected && a.date ? false : a.dateAmbiguous,
      })),
    };
    const payload = reviewDraftToImportPayload(sessionId, prepared);
    // Include selected assessments that now have dates even if still flagged
    payload.assessments = draft.assessments
      .filter((a) => a.selected && a.date)
      .map((a) => ({
        localId: a.localId,
        title: a.title.slice(0, 120),
        assessment_type: (ASSESSMENT_TYPES.includes(a.type as AssessmentType)
          ? a.type
          : "other") as AssessmentType,
        date: a.date as string,
        weightPercent: a.weightPercent,
        notes: a.notes,
        selected: true,
      }));

    const counts = countSelectedImport(payload);
    if (counts.topics + counts.subtopics + counts.assessments === 0) {
      toast.error("Select at least one topic or assessment to import.");
      submittingRef.current = false;
      setImporting(false);
      return;
    }

    startTransition(async () => {
      const result = await importSyllabus(subjectId, payload);
      setImporting(false);
      if (!result.ok) {
        submittingRef.current = false;
        toast.error(result.error);
        return;
      }

      const parts = [
        result.importedTopics ? `${result.importedTopics} topics` : null,
        result.importedSubtopics ? `${result.importedSubtopics} subtopics` : null,
        result.importedAssessments ? `${result.importedAssessments} assessments` : null,
      ].filter(Boolean);

      if (result.partial) {
        toast.success(`Partially imported ${parts.join(", ") || "items"}`, {
          description:
            result.errors[0] ??
            (result.skippedDuplicates.length
              ? `Skipped duplicates: ${result.skippedDuplicates.join(", ")}`
              : undefined),
        });
      } else {
        toast.success(`Imported ${parts.join(", ") || "syllabus items"} into ${subjectName}`);
      }
      handleOpenChange(false);
    });
  };

  const title =
    step === "upload"
      ? "Import with AI"
      : step === "processing"
        ? "Reading syllabus"
        : step === "review"
          ? "Review your syllabus"
          : "Confirm import";

  const description =
    step === "upload"
      ? "Upload a PDF or paste syllabus text. Nothing is saved until you confirm."
      : step === "processing"
        ? "Extracting topics and assessments…"
        : step === "review"
          ? "Edit, deselect, and confirm anything ambiguous before importing."
          : undefined;

  const footer =
    step === "upload" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" disabled={!canExtract} onClick={runExtract}>
          <Sparkles className="size-4" aria-hidden />
          Extract syllabus
        </Button>
      </div>
    ) : step === "review" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-ink-3">
          {selectedCounts.topics} topics · {selectedCounts.subtopics} subtopics ·{" "}
          {selectedCounts.assessments} assessments
          {remaining != null ? ` · ${remaining}/${limit} AI imports left today` : null}
        </p>
        <div className="flex gap-2 sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => setStep("upload")}>
            Back
          </Button>
          <Button
            type="button"
            disabled={
              selectedCounts.topics + selectedCounts.subtopics + selectedCounts.assessments === 0
            }
            onClick={() => setStep("confirm")}
          >
            Continue
          </Button>
        </div>
      </div>
    ) : step === "confirm" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" disabled={importing} onClick={() => setStep("review")}>
          Back
        </Button>
        <Button type="button" disabled={importing || isPending} onClick={confirmImport}>
          {importing ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          Import into {subjectName}
        </Button>
      </div>
    ) : null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={footer}
      className="md:w-[min(720px,calc(100vw-48px))] md:max-h-[min(92svh,880px)]"
    >
      {step === "upload" ? (
        <UploadStep
          text={text}
          setText={(v) => {
            setText(v);
            if (v.trim()) setFile(null);
            setClientError(null);
          }}
          file={file}
          dragOver={dragOver}
          setDragOver={setDragOver}
          pickFile={pickFile}
          fileRef={fileRef}
          privacyAccepted={privacyAccepted}
          setPrivacyAccepted={setPrivacyAccepted}
          clientError={clientError}
          dailyAiLimit={limit}
        />
      ) : null}

      {step === "processing" ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <LoaderCircle className="size-8 animate-spin text-accent-text" aria-hidden />
          <p className="text-[15px] font-medium text-ink">Working through your syllabus…</p>
          <p className="max-w-sm text-[13.5px] text-ink-2">
            PDFs are read visually by Gemini and are not stored in Studi.
          </p>
        </div>
      ) : null}

      {step === "review" && draft ? (
        <ReviewStep
          draft={draft}
          setDraft={setDraft}
          reviewTab={reviewTab}
          setReviewTab={setReviewTab}
        />
      ) : null}

      {step === "confirm" && draft ? (
        <div className="space-y-4 py-2">
          <p className="text-[15px] text-ink">
            Import{" "}
            <span className="font-semibold tabular-nums">{selectedCounts.topics}</span> topics,{" "}
            <span className="font-semibold tabular-nums">{selectedCounts.subtopics}</span>{" "}
            subtopics and{" "}
            <span className="font-semibold tabular-nums">{selectedCounts.assessments}</span>{" "}
            assessments into{" "}
            <span className="font-semibold">{subjectName}</span>?
          </p>
          <ul className="space-y-2 text-[13.5px] text-ink-2">
            <li>Existing topics and progress stay unchanged.</li>
            <li>Duplicate topic titles are skipped.</li>
            <li>Assessments are added without overwriting calendar items.</li>
          </ul>
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}

function UploadStep({
  text,
  setText,
  file,
  dragOver,
  setDragOver,
  pickFile,
  fileRef,
  privacyAccepted,
  setPrivacyAccepted,
  clientError,
  dailyAiLimit,
}: {
  text: string;
  setText: (v: string) => void;
  file: File | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  pickFile: (f: File | null | undefined) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  privacyAccepted: boolean;
  setPrivacyAccepted: (v: boolean) => void;
  clientError: string | null;
  dailyAiLimit: number;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-hairline bg-sunken/60 px-4 py-8 text-center transition-colors",
          dragOver && "border-accent bg-accent-soft/40",
        )}
      >
        <Upload className="size-6 text-ink-3" aria-hidden />
        <div>
          <p className="text-[14px] font-semibold text-ink">Drop a PDF syllabus</p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Max {Math.floor(AI_LIMITS.maxPdfBytes / (1024 * 1024))} MB · {AI_LIMITS.maxPdfPages}{" "}
            pages
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
          <FileText className="size-4" aria-hidden />
          Choose PDF
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {file ? (
          <p className="text-[13px] text-ink-2">
            <span className="font-medium text-ink">{file.name}</span> · {formatBytes(file.size)}
          </p>
        ) : null}
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-1/2 h-px bg-hairline" aria-hidden />
        <p className="relative mx-auto w-fit bg-raised px-3 text-[12px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
          or paste text
        </p>
      </div>

      <Field label={`Syllabus text (${text.length.toLocaleString()} / ${AI_LIMITS.maxTextChars.toLocaleString()})`}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, AI_LIMITS.maxTextChars))}
          rows={7}
          placeholder="Paste the course outline, weekly topics, and exam dates…"
          className="resize-y"
        />
      </Field>

      <label className="flex items-start gap-3 rounded-[16px] bg-sunken px-3.5 py-3 text-[13.5px] text-ink-2">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => setPrivacyAccepted(e.target.checked)}
          className="mt-1 size-4 accent-[var(--accent-ink)]"
        />
        <span>
          I understand this uses Google&apos;s free Gemini tier, and documents I submit may be used
          to improve Google&apos;s products. Studi does not permanently store the uploaded PDF.
        </span>
      </label>

      {clientError ? <FormError message={clientError} /> : null}
      <p className="text-[12.5px] text-ink-3">
        Limit: {dailyAiLimit} AI imports per day.
      </p>
    </div>
  );
}

function ReviewStep({
  draft,
  setDraft,
  reviewTab,
  setReviewTab,
}: {
  draft: SyllabusReviewDraft;
  setDraft: React.Dispatch<React.SetStateAction<SyllabusReviewDraft | null>>;
  reviewTab: ReviewTab;
  setReviewTab: (t: ReviewTab) => void;
}) {
  const update = (recipe: (current: SyllabusReviewDraft) => SyllabusReviewDraft) => {
    setDraft((current) => (current ? recipe(current) : current));
  };

  return (
    <div className="flex flex-col gap-4">
      {draft.warnings.length > 0 ? (
        <div className="rounded-[14px] bg-warning-soft px-3.5 py-3 text-[13px] text-warning">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-3.5" aria-hidden />
            Needs attention
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {draft.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Segmented
        label="Review sections"
        value={reviewTab}
        onChange={setReviewTab}
        stretch
        options={[
          { value: "topics", label: "Topics", count: draft.topics.length },
          { value: "exams", label: "Exams", count: draft.assessments.length },
          { value: "suggestions", label: "Suggestions", count: draft.suggestions.length },
        ]}
      />

      {reviewTab === "topics" ? (
        <ul className="space-y-3">
          {draft.topics.length === 0 ? (
            <p className="text-[13.5px] text-ink-3">No topics were extracted.</p>
          ) : null}
          {draft.topics.map((topic, index) => (
            <li
              key={topic.localId}
              className="rounded-[16px] border border-hairline bg-canvas px-3 py-3"
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={topic.selected}
                  onChange={(e) =>
                    update((d) => ({
                      ...d,
                      topics: d.topics.map((t) =>
                        t.localId === topic.localId ? { ...t, selected: e.target.checked } : t,
                      ),
                    }))
                  }
                  className="mt-2.5 size-4 accent-[var(--accent-ink)]"
                  aria-label={`Include topic ${topic.title}`}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={topic.title}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        topics: d.topics.map((t) =>
                          t.localId === topic.localId
                            ? { ...t, title: e.target.value.slice(0, 120), possibleDuplicate: false }
                            : t,
                        ),
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <SourceBadge tone="extracted">From syllabus</SourceBadge>
                    {topic.estimatedDifficulty !== "unknown" ? (
                      <SourceBadge tone="estimated">
                        AI estimate: {topic.estimatedDifficulty}
                      </SourceBadge>
                    ) : null}
                    {topic.possibleDuplicate ? (
                      <SourceBadge tone="confirm">
                        Possible duplicate
                        {topic.duplicateOfTitle ? `: ${topic.duplicateOfTitle}` : ""}
                      </SourceBadge>
                    ) : null}
                    {topic.sourcePage != null ? (
                      <SourceBadge tone="extracted">p.{topic.sourcePage}</SourceBadge>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
                      disabled={index === 0}
                      onClick={() =>
                        update((d) => {
                          if (index === 0) return d;
                          const topics = [...d.topics];
                          const [item] = topics.splice(index, 1);
                          topics.splice(index - 1, 0, item);
                          return { ...d, topics };
                        })
                      }
                      aria-label="Move topic up"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
                      disabled={index === draft.topics.length - 1}
                      onClick={() =>
                        update((d) => {
                          if (index >= d.topics.length - 1) return d;
                          const topics = [...d.topics];
                          const [item] = topics.splice(index, 1);
                          topics.splice(index + 1, 0, item);
                          return { ...d, topics };
                        })
                      }
                      aria-label="Move topic down"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>

                  <ul className="space-y-2 border-l border-hairline pl-3">
                    {topic.subtopics.map((sub) => (
                      <li key={sub.localId} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={sub.selected}
                          onChange={(e) =>
                            update((d) => ({
                              ...d,
                              topics: d.topics.map((t) =>
                                t.localId !== topic.localId
                                  ? t
                                  : {
                                      ...t,
                                      subtopics: t.subtopics.map((s) =>
                                        s.localId === sub.localId
                                          ? { ...s, selected: e.target.checked }
                                          : s,
                                      ),
                                    },
                              ),
                            }))
                          }
                          className="mt-2.5 size-4 accent-[var(--accent-ink)]"
                          aria-label={`Include subtopic ${sub.title}`}
                        />
                        <Input
                          value={sub.title}
                          onChange={(e) =>
                            update((d) => ({
                              ...d,
                              topics: d.topics.map((t) =>
                                t.localId !== topic.localId
                                  ? t
                                  : {
                                      ...t,
                                      subtopics: t.subtopics.map((s) =>
                                        s.localId === sub.localId
                                          ? { ...s, title: e.target.value.slice(0, 120) }
                                          : s,
                                      ),
                                    },
                              ),
                            }))
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {reviewTab === "exams" ? (
        <ul className="space-y-3">
          {draft.assessments.length === 0 ? (
            <p className="text-[13.5px] text-ink-3">No exams or deadlines were extracted.</p>
          ) : null}
          {draft.assessments.map((exam) => (
            <li
              key={exam.localId}
              className="space-y-2 rounded-[16px] border border-hairline bg-canvas px-3 py-3"
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={exam.selected}
                  disabled={!exam.date}
                  onChange={(e) =>
                    update((d) => ({
                      ...d,
                      assessments: d.assessments.map((a) =>
                        a.localId === exam.localId
                          ? { ...a, selected: e.target.checked, dateAmbiguous: false }
                          : a,
                      ),
                    }))
                  }
                  className="mt-2.5 size-4 accent-[var(--accent-ink)]"
                  aria-label={`Include ${exam.title}`}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={exam.title}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        assessments: d.assessments.map((a) =>
                          a.localId === exam.localId
                            ? { ...a, title: e.target.value.slice(0, 120) }
                            : a,
                        ),
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <SourceBadge tone="extracted">From syllabus</SourceBadge>
                    {exam.needsConfirmation || exam.dateAmbiguous || !exam.date ? (
                      <SourceBadge tone="confirm">Needs confirmation</SourceBadge>
                    ) : null}
                    {exam.weightPercent != null ? (
                      <SourceBadge tone="extracted">Weight {exam.weightPercent}%</SourceBadge>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Type">
                      <select
                        className="h-10 w-full rounded-[12px] bg-sunken px-3 text-[14px] text-ink outline-none"
                        value={exam.type}
                        onChange={(e) =>
                          update((d) => ({
                            ...d,
                            assessments: d.assessments.map((a) =>
                              a.localId === exam.localId
                                ? {
                                    ...a,
                                    type: e.target.value as typeof exam.type,
                                  }
                                : a,
                            ),
                          }))
                        }
                      >
                        {ASSESSMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {ASSESSMENT_TYPE_META[type].label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date">
                      <Input
                        type="date"
                        value={exam.date ?? ""}
                        onChange={(e) =>
                          update((d) => ({
                            ...d,
                            assessments: d.assessments.map((a) =>
                              a.localId === exam.localId
                                ? {
                                    ...a,
                                    date: e.target.value || null,
                                    dateAmbiguous: false,
                                    needsConfirmation: !e.target.value,
                                    selected: Boolean(e.target.value) ? a.selected || true : false,
                                  }
                                : a,
                            ),
                          }))
                        }
                      />
                    </Field>
                  </div>
                  {exam.dateRaw ? (
                    <p className="text-[12.5px] text-ink-3">As written: {exam.dateRaw}</p>
                  ) : null}
                  {exam.weightPercent != null ? (
                    <Field label="Weight %">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={exam.weightPercent}
                        onChange={(e) =>
                          update((d) => ({
                            ...d,
                            assessments: d.assessments.map((a) =>
                              a.localId === exam.localId
                                ? {
                                    ...a,
                                    weightPercent:
                                      e.target.value === ""
                                        ? null
                                        : Math.min(100, Math.max(0, Number(e.target.value))),
                                  }
                                : a,
                            ),
                          }))
                        }
                      />
                    </Field>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {reviewTab === "suggestions" ? (
        <ul className="space-y-2">
          {draft.suggestions.length === 0 ? (
            <p className="text-[13.5px] text-ink-3">No extra suggestions.</p>
          ) : null}
          {draft.suggestions.map((suggestion) => (
            <li
              key={suggestion.localId}
              className="flex items-start gap-2 rounded-[14px] bg-sunken px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={suggestion.selected}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    suggestions: d.suggestions.map((s) =>
                      s.localId === suggestion.localId
                        ? { ...s, selected: e.target.checked }
                        : s,
                    ),
                  }))
                }
                className="mt-1 size-4 accent-[var(--accent-ink)]"
                aria-label="Keep suggestion"
              />
              <div className="min-w-0 flex-1">
                <SourceBadge
                  tone={
                    suggestion.kind === "difficulty_estimate"
                      ? "estimated"
                      : suggestion.kind === "duplicate_topic" || suggestion.kind === "warning"
                        ? "confirm"
                        : "extracted"
                  }
                >
                  {suggestion.kind.replaceAll("_", " ")}
                </SourceBadge>
                <p className="mt-1 text-[13.5px] text-ink">{suggestion.message}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
