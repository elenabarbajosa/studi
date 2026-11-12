import { topicProgressSummary, TOPIC_STATUS_META } from "@/lib/subjects";
import type { Topic } from "@/types/database";

type SubjectProgressProps = {
  topics: Topic[];
};

export function SubjectProgress({ topics }: SubjectProgressProps) {
  const summary = topicProgressSummary(topics);
  const percent =
    summary.completionRatio == null
      ? null
      : Math.round(summary.completionRatio * 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl tracking-tight">Progress</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Based only on your topic statuses. No estimated hours or fake streaks.
        </p>
      </div>

      {summary.total === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Add topics to start tracking real progress.
        </div>
      ) : (
        <>
          <div className="studi-panel p-5">
            <p className="text-sm text-muted-foreground">Completion weight</p>
            <p className="mt-1 font-display text-4xl tracking-tight">
              {percent}%
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Weighted from topic states (
              {TOPIC_STATUS_META.not_started.label}=0 →{" "}
              {TOPIC_STATUS_META.mastered.label}=3).
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Mastered" value={summary.mastered} />
            <Stat label="In progress" value={summary.inProgress} />
            <Stat label="Not started" value={summary.notStarted} />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tracking-tight">{value}</p>
    </div>
  );
}
