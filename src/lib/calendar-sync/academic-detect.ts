import type { ExternalCalendarEvent } from "@/lib/calendar-sync/types";

export type AcademicSuggestionKind = "exam" | "assignment" | "ignore_default";

export type AcademicSuggestion = {
  eventId: string;
  kind: AcademicSuggestionKind;
  proposedType: string;
  confidence: "low" | "medium";
  reason: string;
};

const EXAM_RE =
  /\b(exam|midterm|final|quiz|test|oral exam|examen|parcial|finale)\b/i;
const ASSIGNMENT_RE =
  /\b(assignment|homework|due|deadline|essay|project due|paper due|submission|entregable|trabajo)\b/i;

/**
 * Conservative title-based detection. Never auto-imports — UI must confirm.
 * Confidence stays low/medium; no Gemini in v1.
 */
export function detectAcademicCandidates(
  events: readonly Pick<
    ExternalCalendarEvent,
    "id" | "title" | "description" | "all_day" | "is_cancelled"
  >[],
): AcademicSuggestion[] {
  const out: AcademicSuggestion[] = [];
  for (const event of events) {
    if (event.is_cancelled) continue;
    const text = `${event.title}\n${event.description ?? ""}`;
    if (EXAM_RE.test(text)) {
      const isMidterm = /\bmidterm|parcial\b/i.test(text);
      const isFinal = /\bfinal\b/i.test(text);
      const isQuiz = /\bquiz\b/i.test(text);
      out.push({
        eventId: event.id,
        kind: "exam",
        proposedType: isQuiz
          ? "quiz"
          : isMidterm
            ? "midterm"
            : isFinal
              ? "final"
              : "other",
        confidence: "medium",
        reason: "Title or description mentions an exam-like term.",
      });
      continue;
    }
    if (ASSIGNMENT_RE.test(text)) {
      out.push({
        eventId: event.id,
        kind: "assignment",
        proposedType: "assignment",
        confidence: "low",
        reason: "Title or description looks like a deadline or assignment.",
      });
    }
  }
  return out;
}
