import type { GradeSummary } from "@/lib/grades/types";
import { roundToDecimals } from "@/lib/grades/math";

export function gradeInsightLines(summary: GradeSummary): string[] {
  const lines: string[] = [];
  const graded = summary.contributions.filter((c) => c.normalizedActual != null);

  if (!graded.length) {
    lines.push("No grades recorded yet — pending assessments are not counted as zeros.");
    return lines;
  }

  const sorted = graded
    .slice()
    .sort(
      (a, b) => (a.normalizedActual ?? 0) - (b.normalizedActual ?? 0),
    );
  const lowest = sorted[0]!;
  const highest = sorted[sorted.length - 1]!;
  lines.push(
    `Highest: ${highest.title} (${roundToDecimals(highest.normalizedActual!, 1)}%).`,
  );
  lines.push(
    `Lowest: ${lowest.title} (${roundToDecimals(lowest.normalizedActual!, 1)}%).`,
  );

  if (graded.length >= 2) {
    const first = graded[0]!.normalizedActual!;
    const last = graded[graded.length - 1]!.normalizedActual!;
    if (last > first + 0.5) {
      lines.push("Recent graded assessments trend higher than earlier ones.");
    } else if (last < first - 0.5) {
      lines.push("Recent graded assessments trend lower than earlier ones.");
    } else {
      lines.push("Graded assessments are relatively steady so far.");
    }
  }

  lines.push(
    `${roundToDecimals(summary.remainingWeight, 1)}% of the scheme weight is still pending.`,
  );

  const impact = summary.contributions
    .filter((c) => c.actualScore == null && c.effectiveWeight > 0)
    .slice()
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight);
  if (impact[0]) {
    lines.push(
      `“${impact[0].title}” has the largest remaining weight (${roundToDecimals(impact[0].effectiveWeight, 1)}%).`,
    );
  }

  if (!summary.schemeComplete) {
    lines.push("Grading scheme weights do not yet total 100% (draft).");
  }

  return lines;
}
