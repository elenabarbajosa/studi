import { Users } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata = { title: "Friends" };

export default function FriendsPage() {
  return (
    <FeaturePlaceholder
      title="Friends"
      description="Find classmates and keep study companions close."
      icon={Users}
      emptyTitle="Friends arrive later"
      emptyDescription="Friend requests and profiles stay private for now. Social features unlock in a future phase."
    />
  );
}
