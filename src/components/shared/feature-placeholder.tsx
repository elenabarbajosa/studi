import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

type FeaturePlaceholderProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
};

export function FeaturePlaceholder({
  title,
  description,
  emptyTitle,
  emptyDescription,
  icon,
}: FeaturePlaceholderProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        description={emptyDescription}
      />
    </div>
  );
}
