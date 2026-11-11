import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile } = await requireProfile();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile, appearance, and accent preferences."
      />
      <SettingsForm profile={profile} />
    </div>
  );
}
