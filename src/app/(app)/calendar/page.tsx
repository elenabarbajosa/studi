import { CalendarDays } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <FeaturePlaceholder
      title="Calendar"
      description="Keep exams, assignments, and study blocks in one academic calendar."
      icon={CalendarDays}
      emptyTitle="No calendar yet"
      emptyDescription="Events and deadlines will appear here once the calendar module ships. Nothing is simulated."
    />
  );
}
