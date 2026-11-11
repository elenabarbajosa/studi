import { BookOpen } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata = { title: "Subjects" };

export default function SubjectsPage() {
  return (
    <FeaturePlaceholder
      title="Subjects"
      description="Notion-style organization for courses, notes, and resources."
      icon={BookOpen}
      emptyTitle="No subjects yet"
      emptyDescription="Create subjects in a later phase. Your private course space stays empty until then."
    />
  );
}
