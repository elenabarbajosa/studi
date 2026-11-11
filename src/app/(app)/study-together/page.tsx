import { Handshake } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata = { title: "Study Together" };

export default function StudyTogetherPage() {
  return (
    <FeaturePlaceholder
      title="Study Together"
      description="Virtual rooms, challenges, and shared focus sessions."
      icon={Handshake}
      emptyTitle="No study rooms yet"
      emptyDescription="Virtual rooms and challenges are planned for later. This page stays empty until then."
    />
  );
}
