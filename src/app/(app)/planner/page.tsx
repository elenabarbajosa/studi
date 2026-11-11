import { ClipboardList } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata = { title: "Study Planner" };

export default function PlannerPage() {
  return (
    <FeaturePlaceholder
      title="Study Planner"
      description="Customizable weekly planners tailored to university workloads."
      icon={ClipboardList}
      emptyTitle="Planner coming soon"
      emptyDescription="Plans and tasks will live here. Phase 1 keeps this surface intentionally empty."
    />
  );
}
