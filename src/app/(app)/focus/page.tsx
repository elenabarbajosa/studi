import { Focus } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata = { title: "Focus" };

export default function FocusPage() {
  return (
    <FeaturePlaceholder
      title="Focus"
      description="Pomodoro timers and session history without distraction clutter."
      icon={Focus}
      emptyTitle="Focus tools not ready"
      emptyDescription="Timers and session logs arrive later. No placeholder focus minutes are shown."
    />
  );
}
