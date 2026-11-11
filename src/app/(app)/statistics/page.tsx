import { ChartColumn } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata = { title: "Statistics" };

export default function StatisticsPage() {
  return (
    <FeaturePlaceholder
      title="Statistics"
      description="Honest productivity insights based on your real sessions."
      icon={ChartColumn}
      emptyTitle="No statistics yet"
      emptyDescription="Charts and leaderboards will reflect real activity only. Nothing is fabricated here."
    />
  );
}
