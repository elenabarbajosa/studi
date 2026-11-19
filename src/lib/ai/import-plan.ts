import { buildEventRange } from "@/lib/calendar";
import {
  findDuplicateTitles,
  isDuplicateTitle,
  normalizeTopicTitle,
} from "@/lib/ai/duplicates";
import {
  syllabusExtractionSchema,
  toAssessmentType,
  type ImportSyllabusPayload,
  type SyllabusExtraction,
  type SyllabusReviewDraft,
} from "@/lib/ai/schemas";

let localIdCounter = 0;

export function resetLocalIdCounter(seed = 0) {
  localIdCounter = seed;
}

export function nextLocalId(prefix = "item"): string {
  localIdCounter += 1;
  return `${prefix}_${localIdCounter}`;
}

export function parseSyllabusExtraction(raw: unknown): SyllabusExtraction {
  return syllabusExtractionSchema.parse(raw);
}

export function safeParseSyllabusExtraction(raw: unknown) {
  return syllabusExtractionSchema.safeParse(raw);
}

export function extractionToReviewDraft(
  extraction: SyllabusExtraction,
  existingTopicTitles: string[],
): SyllabusReviewDraft {
  const rootTitles = extraction.topics.map((t) => t.title);
  const duplicates = findDuplicateTitles(rootTitles, existingTopicTitles);
  const dupMap = new Map(duplicates.map((d) => [normalizeTopicTitle(d.title), d]));

  const topics = extraction.topics
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((topic) => {
      const dup = dupMap.get(normalizeTopicTitle(topic.title));
      const notesParts = [
        topic.description,
        topic.sourceTerm && topic.sourceTerm !== topic.title
          ? `Source: ${topic.sourceTerm}`
          : null,
        topic.estimatedDifficulty && topic.estimatedDifficulty !== "unknown"
          ? `AI estimate: ${topic.estimatedDifficulty} difficulty`
          : null,
        topic.sourcePage != null ? `Syllabus p.${topic.sourcePage}` : null,
      ].filter(Boolean);

      return {
        localId: nextLocalId("topic"),
        title: topic.title.slice(0, 120),
        description: topic.description,
        sourceTerm: topic.sourceTerm,
        order: topic.order ?? 0,
        estimatedDifficulty: topic.estimatedDifficulty ?? "unknown",
        sourcePage: topic.sourcePage ?? null,
        selected: !dup,
        possibleDuplicate: Boolean(dup),
        duplicateOfTitle: dup?.existingTitle ?? null,
        subtopics: (topic.subtopics ?? [])
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((sub) => ({
            localId: nextLocalId("sub"),
            title: sub.title.slice(0, 120),
            description: sub.description,
            sourceTerm: sub.sourceTerm,
            order: sub.order ?? 0,
            estimatedDifficulty: sub.estimatedDifficulty ?? "unknown",
            sourcePage: sub.sourcePage ?? null,
            selected: true,
          })),
        // keep notes helper available to UI via description fields
        ...(notesParts.length ? {} : {}),
      };
    });

  const assessments = extraction.assessments.map((a) => {
    const needsConfirmation = !a.date || a.dateAmbiguous;
    return {
      localId: nextLocalId("exam"),
      title: a.title.slice(0, 120),
      type: a.type ?? "other",
      date: a.date,
      dateAmbiguous: a.dateAmbiguous ?? false,
      dateRaw: a.dateRaw,
      weightPercent: a.weightPercent,
      sourcePage: a.sourcePage,
      notes: a.notes,
      selected: !needsConfirmation,
      needsConfirmation,
    };
  });

  const suggestions = [
    ...duplicates.map((d) => ({
      localId: nextLocalId("sug"),
      kind: "duplicate_topic" as const,
      message: `"${d.title}" looks like existing topic "${d.existingTitle}".`,
      relatedTopicTitle: d.title,
      selected: true,
    })),
    ...extraction.suggestions.map((s) => ({
      localId: nextLocalId("sug"),
      kind: s.kind,
      message: s.message,
      relatedTopicTitle: s.relatedTopicTitle,
      selected: true,
    })),
    ...topics
      .filter((t) => t.estimatedDifficulty && t.estimatedDifficulty !== "unknown")
      .map((t) => ({
        localId: nextLocalId("sug"),
        kind: "difficulty_estimate" as const,
        message: `AI estimate: "${t.title}" may be ${t.estimatedDifficulty}.`,
        relatedTopicTitle: t.title,
        selected: true,
      })),
  ];

  return {
    language: extraction.language,
    topics,
    assessments,
    suggestions,
    warnings: extraction.warnings ?? [],
  };
}

export function countSelectedImport(payload: ImportSyllabusPayload) {
  let topics = 0;
  let subtopics = 0;
  let assessments = 0;

  for (const topic of payload.topics) {
    if (!topic.selected) continue;
    topics += 1;
    subtopics += topic.subtopics.filter((s) => s.selected).length;
  }
  assessments = payload.assessments.filter((a) => a.selected).length;

  return { topics, subtopics, assessments };
}

export function buildTopicNotes(parts: {
  description?: string | null;
  sourceTerm?: string | null;
  title?: string;
  estimatedDifficulty?: string | null;
  sourcePage?: number | null;
}): string | null {
  const lines: string[] = [];
  if (parts.description?.trim()) lines.push(parts.description.trim());
  if (parts.sourceTerm?.trim() && parts.sourceTerm.trim() !== parts.title?.trim()) {
    lines.push(`Source: ${parts.sourceTerm.trim()}`);
  }
  if (parts.estimatedDifficulty && parts.estimatedDifficulty !== "unknown") {
    lines.push(`AI estimate: ${parts.estimatedDifficulty} difficulty`);
  }
  if (parts.sourcePage != null) lines.push(`Syllabus p.${parts.sourcePage}`);
  const joined = lines.join("\n").slice(0, 4000);
  return joined || null;
}

export function buildAssessmentDescription(parts: {
  notes?: string | null;
  weightPercent?: number | null;
  sourcePage?: number | null;
}): string | null {
  const lines: string[] = [];
  if (parts.weightPercent != null) lines.push(`Weight: ${parts.weightPercent}%`);
  if (parts.notes?.trim()) lines.push(parts.notes.trim());
  if (parts.sourcePage != null) lines.push(`Syllabus p.${parts.sourcePage}`);
  const joined = lines.join("\n").slice(0, 2000);
  return joined || null;
}

export type PlannedTopicInsert = {
  localId: string;
  title: string;
  notes: string | null;
  sort_order: number;
  subtopics: {
    localId: string;
    title: string;
    notes: string | null;
    sort_order: number;
  }[];
};

export type PlannedAssessmentInsert = {
  localId: string;
  title: string;
  assessment_type: ReturnType<typeof toAssessmentType>;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  description: string | null;
};

export function planImportInserts(
  payload: ImportSyllabusPayload,
  existingTopicTitles: string[],
  timeZone = "UTC",
): {
  topics: PlannedTopicInsert[];
  assessments: PlannedAssessmentInsert[];
  skippedDuplicates: string[];
  skippedAssessments: string[];
} {
  const skippedDuplicates: string[] = [];
  const topics: PlannedTopicInsert[] = [];
  let rootOrder = 0;

  for (const topic of payload.topics) {
    if (!topic.selected) continue;
    if (isDuplicateTitle(topic.title, existingTopicTitles)) {
      skippedDuplicates.push(topic.title);
      continue;
    }

    const subtopics = topic.subtopics
      .filter((s) => s.selected)
      .map((s, index) => ({
        localId: s.localId,
        title: s.title.trim().slice(0, 120),
        notes: s.notes?.trim() ? s.notes.trim().slice(0, 4000) : null,
        sort_order: index,
      }));

    topics.push({
      localId: topic.localId,
      title: topic.title.trim().slice(0, 120),
      notes: topic.notes?.trim() ? topic.notes.trim().slice(0, 4000) : null,
      sort_order: rootOrder,
      subtopics,
    });
    rootOrder += 1;
    existingTopicTitles = [...existingTopicTitles, topic.title];
  }

  const skippedAssessments: string[] = [];
  const assessments: PlannedAssessmentInsert[] = [];

  for (const assessment of payload.assessments) {
    if (!assessment.selected) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(assessment.date)) {
      skippedAssessments.push(assessment.title);
      continue;
    }
    const range = buildEventRange({
      date: assessment.date,
      allDay: true,
      timeZone,
    });
    assessments.push({
      localId: assessment.localId,
      title: assessment.title.trim().slice(0, 120),
      assessment_type: toAssessmentType(assessment.assessment_type),
      starts_at: range.starts_at,
      ends_at: range.ends_at ?? range.starts_at,
      all_day: true,
      description: buildAssessmentDescription({
        notes: assessment.notes,
        weightPercent: assessment.weightPercent,
      }),
    });
  }

  return { topics, assessments, skippedDuplicates, skippedAssessments };
}

export function reviewDraftToImportPayload(
  sessionId: string,
  draft: SyllabusReviewDraft,
): ImportSyllabusPayload {
  return {
    sessionId,
    topics: draft.topics.map((t) => ({
      localId: t.localId,
      title: t.title.slice(0, 120),
      notes: buildTopicNotes({
        description: t.description,
        sourceTerm: t.sourceTerm,
        title: t.title,
        estimatedDifficulty: t.estimatedDifficulty,
        sourcePage: t.sourcePage,
      }),
      selected: t.selected,
      subtopics: t.subtopics.map((s) => ({
        localId: s.localId,
        title: s.title.slice(0, 120),
        notes: buildTopicNotes({
          description: s.description,
          sourceTerm: s.sourceTerm,
          title: s.title,
          estimatedDifficulty: s.estimatedDifficulty,
          sourcePage: s.sourcePage,
        }),
        selected: s.selected,
      })),
    })),
    assessments: draft.assessments
      .filter((a) => a.selected && a.date && !a.dateAmbiguous)
      .map((a) => ({
        localId: a.localId,
        title: a.title.slice(0, 120),
        assessment_type: toAssessmentType(a.type),
        date: a.date as string,
        weightPercent: a.weightPercent,
        notes: a.notes,
        selected: true,
      })),
  };
}
